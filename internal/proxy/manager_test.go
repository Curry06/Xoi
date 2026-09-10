package proxy

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_Proxy_Validation(t *testing.T) {
	t.Parallel()

	testCases := map[string]struct {
		route       ProxyRoute
		expectedErr string
	}{
		"empty_name": {
			route: ProxyRoute{
				Name:        "",
				RoutingType: RoutingTypeDomain,
				Domain:      "app.example.com",
				Protocol:    "http",
				TargetHost:  "127.0.0.1",
				TargetPort:  3001,
			},
			expectedErr: "route name cannot be empty",
		},
		"empty_domain": {
			route: ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypeDomain,
				Domain:      "",
				Protocol:    "http",
				TargetHost:  "127.0.0.1",
				TargetPort:  3001,
			},
			expectedErr: "domain name cannot be empty for domain routing",
		},
		"invalid_domain": {
			route: ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypeDomain,
				Domain:      "invalid_domain!",
				Protocol:    "http",
				TargetHost:  "127.0.0.1",
				TargetPort:  3001,
			},
			expectedErr: "domain format is invalid",
		},
		"empty_path": {
			route: ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypePath,
				Path:        "",
				Protocol:    "http",
				TargetHost:  "127.0.0.1",
				TargetPort:  3001,
			},
			expectedErr: "path cannot be empty for path routing",
		},
		"invalid_path_no_slash": {
			route: ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypePath,
				Path:        "api/v1",
				Protocol:    "http",
				TargetHost:  "127.0.0.1",
				TargetPort:  3001,
			},
			expectedErr: "path must start with '/'",
		},
		"reserved_port_caddy_admin": {
			route: ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypeDomain,
				Domain:      "app.example.com",
				Protocol:    "http",
				TargetHost:  "127.0.0.1",
				TargetPort:  2019,
			},
			expectedErr: "target port is reserved",
		},
		"reserved_port_gluetun": {
			route: ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypeDomain,
				Domain:      "app.example.com",
				Protocol:    "http",
				TargetHost:  "127.0.0.1",
				TargetPort:  8000,
			},
			expectedErr: "target port is reserved",
		},
		"invalid_target_unspecified_ip": {
			route: ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypeDomain,
				Domain:      "app.example.com",
				Protocol:    "http",
				TargetHost:  "0.0.0.0",
				TargetPort:  3001,
			},
			expectedErr: "target host is invalid (0.0.0.0 is not allowed)",
		},
		"invalid_protocol": {
			route: ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypeDomain,
				Domain:      "app.example.com",
				Protocol:    "ftp",
				TargetHost:  "127.0.0.1",
				TargetPort:  3001,
			},
			expectedErr: "protocol must be 'http', 'https', or 'websocket'",
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			err := validateRouteFields(tc.route)
			require.Error(t, err)
			assert.ErrorContains(t, err, tc.expectedErr)
		})
	}
}

func Test_Proxy_TargetPolicy(t *testing.T) {
	t.Parallel()

	testCases := map[string]struct {
		targetHost  string
		targetPort  uint16
		expectedErr string
	}{
		"remote_address": {
			targetHost:  "198.51.100.1",
			targetPort:  3001,
			expectedErr: "target host is not allowed",
		},
		"metadata_address": {
			targetHost:  "169.254.169.254",
			targetPort:  80,
			expectedErr: "target host is not allowed",
		},
		"management_port": {
			targetHost:  "127.0.0.1",
			targetPort:  8000,
			expectedErr: "target port is reserved",
		},
		"public_tls": {
			targetHost:  "127.0.0.1",
			targetPort:  3001,
			expectedErr: "public TLS requires DNS-01",
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			route := ProxyRoute{
				Name:        "Test App",
				RoutingType: RoutingTypeDomain,
				Domain:      "app.example.com",
				Protocol:    "http",
				TargetHost:  testCase.targetHost,
				TargetPort:  testCase.targetPort,
			}
			if name == "public_tls" {
				route.TLS = true
			}

			err := validateRouteFields(route)
			require.Error(t, err)
			assert.ErrorContains(t, err, testCase.expectedErr)
		})
	}
}

func Test_Manager_CRUD_And_Collisions(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	storePath := filepath.Join(tempDir, "test_routes.json")

	store, err := NewStore(storePath)
	require.NoError(t, err)

	mockProvider := NewMockProvider(8080)
	manager := NewManager(store, mockProvider, nil, 8080)
	ctx := context.Background()

	// 1. Create Route 1
	route1 := ProxyRoute{
		Name:        "ResQID Frontend",
		RoutingType: RoutingTypeDomain,
		Domain:      "resqid.example.com",
		Protocol:    "http",
		TargetHost:  "127.0.0.1",
		TargetPort:  3001,
		Enabled:     true,
		WebSocket:   true,
		HealthCheck: true,
	}

	created1, err := manager.CreateRoute(ctx, route1)
	require.NoError(t, err)
	assert.NotEmpty(t, created1.ID)
	assert.Equal(t, "resqid.example.com", created1.Domain)

	// 2. Collision Check: Same domain
	duplicateRoute := ProxyRoute{
		Name:        "Another App",
		RoutingType: RoutingTypeDomain,
		Domain:      "resqid.example.com",
		Protocol:    "http",
		TargetHost:  "127.0.0.1",
		TargetPort:  3002,
		Enabled:     true,
	}
	_, err = manager.CreateRoute(ctx, duplicateRoute)
	require.Error(t, err)
	assert.ErrorContains(t, err, "another route with this domain already exists")

	// 3. Create Route 2 (Path route)
	route2 := ProxyRoute{
		Name:        "API Backend",
		RoutingType: RoutingTypePath,
		Path:        "/api/v1",
		Protocol:    "http",
		TargetHost:  "127.0.0.1",
		TargetPort:  8081,
		Enabled:     true,
	}
	created2, err := manager.CreateRoute(ctx, route2)
	require.NoError(t, err)
	assert.NotEmpty(t, created2.ID)

	// 4. Collision Check: Same path
	duplicatePathRoute := ProxyRoute{
		Name:        "Another API",
		RoutingType: RoutingTypePath,
		Path:        "/api/v1/",
		Protocol:    "http",
		TargetHost:  "127.0.0.1",
		TargetPort:  8082,
	}
	_, err = manager.CreateRoute(ctx, duplicatePathRoute)
	require.Error(t, err)
	assert.ErrorContains(t, err, "another route with this path already exists")

	// 5. List Routes
	list := manager.ListRoutes()
	assert.Len(t, list, 2)

	// 6. Disable Route
	err = manager.DisableRoute(ctx, created1.ID)
	require.NoError(t, err)
	updated, _, exists := manager.GetRoute(created1.ID)
	assert.True(t, exists)
	assert.False(t, updated.Enabled)
	assert.Equal(t, StatusDisabled, updated.Status)

	// 7. Enable Route
	err = manager.EnableRoute(ctx, created1.ID)
	require.NoError(t, err)
	updated, _, exists = manager.GetRoute(created1.ID)
	assert.True(t, exists)
	assert.True(t, updated.Enabled)

	// 8. Delete Route
	err = manager.DeleteRoute(ctx, created2.ID)
	require.NoError(t, err)
	list = manager.ListRoutes()
	assert.Len(t, list, 1)
	assert.Equal(t, created1.ID, list[0].ID)
}

func Test_Manager_RollbackOnProviderFailure(t *testing.T) {
	t.Parallel()

	store, err := NewStore("")
	require.NoError(t, err)

	mockProvider := NewMockProvider(8080)
	mockProvider.SetFailSync(true) // Force provider to fail

	manager := NewManager(store, mockProvider, nil, 8080)
	ctx := context.Background()

	route := ProxyRoute{
		Name:        "Test App",
		RoutingType: RoutingTypeDomain,
		Domain:      "test.example.com",
		Protocol:    "http",
		TargetHost:  "127.0.0.1",
		TargetPort:  3001,
		Enabled:     true,
	}

	_, err = manager.CreateRoute(ctx, route)
	require.Error(t, err)
	assert.ErrorContains(t, err, "applying route set to proxy provider")

	// Verify rollback: route was NOT persisted to store
	assert.Empty(t, manager.ListRoutes())
}

func Test_Manager_HealthCheckUsesCaddyIngress(t *testing.T) {
	t.Parallel()

	requestReceived := make(chan struct{}, 1)
	caddyIngress := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		assert.Equal(t, "app.example.com", request.Host)
		assert.Equal(t, "/", request.URL.Path)
		requestReceived <- struct{}{}
		writer.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(caddyIngress.Close)

	store, err := NewStore("")
	require.NoError(t, err)
	healthChecker := NewTargetHealthChecker(time.Second)
	healthChecker.SetIngressURL(caddyIngress.URL)
	manager := NewManager(store, NewMockProvider(8080), healthChecker, 8080)
	manager.UpdatePublicEndpoint(PublicEndpoint{Status: "active"})

	route, err := manager.CreateRoute(context.Background(), ProxyRoute{
		Name:        "Application",
		RoutingType: RoutingTypeDomain,
		Domain:      "app.example.com",
		Protocol:    "http",
		TargetHost:  "127.0.0.1",
		TargetPort:  3001,
		Enabled:     true,
		HealthCheck: true,
	})
	require.NoError(t, err)
	assert.Equal(t, StatusActive, route.Status)

	select {
	case <-requestReceived:
	case <-time.After(time.Second):
		t.Fatal("expected Caddy ingress health request")
	}
}

func Test_Metrics_Registry(t *testing.T) {
	t.Parallel()

	registry := NewRouteMetricsRegistry()
	routeID := "route_123"

	// Record requests
	registry.RecordRequest(routeID, 100, 200, 10.0, false)
	registry.RecordRequest(routeID, 150, 300, 20.0, false)
	registry.RecordRequest(routeID, 50, 100, 30.0, true)

	metrics := registry.GetRouteMetrics(routeID)
	assert.Equal(t, uint64(3), metrics.TotalRequests)
	assert.Equal(t, uint64(300), metrics.BytesReceived)
	assert.Equal(t, uint64(600), metrics.BytesSent)
	assert.Equal(t, uint64(1), metrics.ErrorCount)
	assert.Equal(t, 20.0, metrics.AverageLatencyMs)
}

func Test_Caddy_Config_Generation(t *testing.T) {
	t.Parallel()

	caddyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/load", r.URL.Path)
		w.WriteHeader(http.StatusOK)
	}))
	defer caddyServer.Close()

	provider := NewCaddyProvider(caddyServer.URL, 8080)
	ctx := context.Background()

	routes := []ProxyRoute{
		{
			ID:          "route_1",
			Name:        "Domain Route",
			RoutingType: RoutingTypeDomain,
			Domain:      "app.example.com",
			TargetHost:  "127.0.0.1",
			TargetPort:  3001,
			Enabled:     true,
		},
		{
			ID:          "route_2",
			Name:        "Path Route",
			RoutingType: RoutingTypePath,
			Path:        "/api",
			Protocol:    "https",
			TargetHost:  "127.0.0.1",
			TargetPort:  8000,
			Enabled:     true,
		},
		{
			ID:          "route_disabled",
			Name:        "Disabled Route",
			RoutingType: RoutingTypeDomain,
			Domain:      "disabled.example.com",
			TargetHost:  "127.0.0.1",
			TargetPort:  9999,
			Enabled:     false,
		},
	}

	err := provider.SyncRoutes(ctx, 8080, routes)
	require.NoError(t, err)

	config := provider.buildCaddyConfigJSON()
	apps := config["apps"].(map[string]any)
	httpApp := apps["http"].(map[string]any)
	servers := httpApp["servers"].(map[string]any)
	vpnIngress := servers["vpn_ingress"].(map[string]any)
	caddyRoutes := vpnIngress["routes"].([]map[string]any)

	// Disabled routes are excluded and the final route returns a deterministic 404.
	assert.Len(t, caddyRoutes, 3)
	assert.Equal(t, "static_response", caddyRoutes[2]["handle"].([]map[string]any)[0]["handler"])
	assert.Equal(t, map[string]any{"protocol": "http", "tls": map[string]any{}}, caddyRoutes[1]["handle"].([]map[string]any)[0]["transport"])
}
