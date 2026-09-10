package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	errCaddyAdminUnreachable = errors.New("caddy admin API unreachable")
	errCaddyLoadFailed       = errors.New("caddy configuration load failed")
)

type CaddyProvider struct {
	client      *http.Client
	adminURL    string
	adminListen string
	listenPort  uint16
	mutex       sync.RWMutex
	routes      map[string]ProxyRoute
}

func NewCaddyProvider(adminAddress string, defaultListenPort uint16) *CaddyProvider {
	if defaultListenPort == 0 {
		defaultListenPort = 8080
	}

	client, adminURL, adminListen := caddyAdminClient(adminAddress)
	return &CaddyProvider{
		client:      client,
		adminURL:    adminURL,
		adminListen: adminListen,
		listenPort:  defaultListenPort,
		routes:      make(map[string]ProxyRoute),
	}
}

func (provider *CaddyProvider) Ping(ctx context.Context) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, provider.adminURL+"/config/", nil)
	if err != nil {
		return fmt.Errorf("creating caddy ping request: %w", err)
	}

	response, err := provider.client.Do(request)
	if err != nil {
		return fmt.Errorf("%w: %w", errCaddyAdminUnreachable, err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("%w (status code %d)", errCaddyAdminUnreachable, response.StatusCode)
	}

	return nil
}

func (provider *CaddyProvider) SyncRoutes(ctx context.Context, listenPort uint16, routes []ProxyRoute) error {
	provider.mutex.Lock()
	defer provider.mutex.Unlock()

	if listenPort > 0 {
		provider.listenPort = listenPort
	}

	candidateRoutes := routesToMap(routes)
	err := provider.applyConfigLocked(ctx, candidateRoutes)
	if err != nil {
		return err
	}
	provider.routes = candidateRoutes
	return nil
}

func (provider *CaddyProvider) CreateRoute(ctx context.Context, route ProxyRoute) error {
	provider.mutex.Lock()
	defer provider.mutex.Unlock()

	candidateRoutes := copyRouteMap(provider.routes)
	candidateRoutes[route.ID] = route
	err := provider.applyConfigLocked(ctx, candidateRoutes)
	if err != nil {
		return err
	}
	provider.routes = candidateRoutes
	return nil
}

func (provider *CaddyProvider) UpdateRoute(ctx context.Context, route ProxyRoute) error {
	return provider.CreateRoute(ctx, route)
}

func (provider *CaddyProvider) DeleteRoute(ctx context.Context, id string) error {
	provider.mutex.Lock()
	defer provider.mutex.Unlock()

	candidateRoutes := copyRouteMap(provider.routes)
	delete(candidateRoutes, id)
	err := provider.applyConfigLocked(ctx, candidateRoutes)
	if err != nil {
		return err
	}
	provider.routes = candidateRoutes
	return nil
}

func (provider *CaddyProvider) EnableRoute(ctx context.Context, id string) error {
	provider.mutex.Lock()
	defer provider.mutex.Unlock()

	candidateRoutes := copyRouteMap(provider.routes)
	route, exists := candidateRoutes[id]
	if !exists {
		return nil
	}
	route.Enabled = true
	candidateRoutes[id] = route
	err := provider.applyConfigLocked(ctx, candidateRoutes)
	if err != nil {
		return err
	}
	provider.routes = candidateRoutes
	return nil
}

func (provider *CaddyProvider) DisableRoute(ctx context.Context, id string) error {
	provider.mutex.Lock()
	defer provider.mutex.Unlock()

	candidateRoutes := copyRouteMap(provider.routes)
	route, exists := candidateRoutes[id]
	if !exists {
		return nil
	}
	route.Enabled = false
	candidateRoutes[id] = route
	err := provider.applyConfigLocked(ctx, candidateRoutes)
	if err != nil {
		return err
	}
	provider.routes = candidateRoutes
	return nil
}

func (provider *CaddyProvider) ListRoutes(_ context.Context) ([]ProxyRoute, error) {
	provider.mutex.RLock()
	defer provider.mutex.RUnlock()

	routes := make([]ProxyRoute, 0, len(provider.routes))
	for _, route := range provider.routes {
		routes = append(routes, route)
	}
	sortRoutes(routes)
	return routes, nil
}

func (provider *CaddyProvider) applyConfigLocked(ctx context.Context, routes map[string]ProxyRoute) error {
	caddyConfig := provider.buildCaddyConfigForRoutes(routes)
	configBytes, err := json.Marshal(caddyConfig)
	if err != nil {
		return fmt.Errorf("marshaling caddy config: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, provider.adminURL+"/load", bytes.NewReader(configBytes))
	if err != nil {
		return fmt.Errorf("creating caddy load request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := provider.client.Do(request)
	if err != nil {
		return fmt.Errorf("%w: %w", errCaddyAdminUnreachable, err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		bodyBytes, _ := io.ReadAll(response.Body)
		return fmt.Errorf("%w: status %d: %s", errCaddyLoadFailed, response.StatusCode, string(bodyBytes))
	}

	return nil
}

func (provider *CaddyProvider) buildCaddyConfigJSON() map[string]any {
	provider.mutex.RLock()
	defer provider.mutex.RUnlock()
	return provider.buildCaddyConfigForRoutes(provider.routes)
}

func (provider *CaddyProvider) buildCaddyConfigForRoutes(routes map[string]ProxyRoute) map[string]any {
	routesList := make([]ProxyRoute, 0, len(routes))
	for _, route := range routes {
		if route.Enabled {
			routesList = append(routesList, route)
		}
	}
	sortRoutes(routesList)

	caddyRoutes := make([]map[string]any, 0, len(routesList)+1)
	for _, route := range routesList {
		match := routeMatch(route)
		dialTarget := net.JoinHostPort(route.TargetHost, fmt.Sprintf("%d", route.TargetPort))
		reverseProxyHandler := map[string]any{
			"handler": "reverse_proxy",
			"upstreams": []map[string]any{{
				"dial": dialTarget,
			}},
		}
		if route.Protocol == "https" {
			reverseProxyHandler["transport"] = map[string]any{
				"protocol": "http",
				"tls":      map[string]any{},
			}
		}

		caddyRoutes = append(caddyRoutes, map[string]any{
			"@id":      route.ID,
			"match":    []map[string]any{match},
			"handle":   []map[string]any{reverseProxyHandler},
			"terminal": true,
		})
	}
	caddyRoutes = append(caddyRoutes, map[string]any{
		"handle": []map[string]any{{
			"handler":     "static_response",
			"status_code": http.StatusNotFound,
		}},
		"terminal": true,
	})

	listenAddress := fmt.Sprintf(":%d", provider.listenPort)
	return map[string]any{
		"admin": map[string]any{
			"listen": provider.adminListen,
		},
		"apps": map[string]any{
			"http": map[string]any{
				"servers": map[string]any{
					"vpn_ingress": map[string]any{
						"listen": []string{listenAddress},
						"automatic_https": map[string]any{
							"disable": true,
						},
						"routes": caddyRoutes,
					},
				},
			},
		},
	}
}

func caddyAdminClient(adminAddress string) (*http.Client, string, string) {
	const defaultAdminAddress = "http://127.0.0.1:2019"
	if adminAddress == "" {
		adminAddress = defaultAdminAddress
	}

	if strings.HasPrefix(adminAddress, "unix://") {
		socketPath := strings.TrimPrefix(adminAddress, "unix://")
		if socketPath == "" {
			socketPath = "/run/caddy/admin.sock"
		}
		dialer := &net.Dialer{Timeout: 5 * time.Second}
		transport := &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return dialer.DialContext(ctx, "unix", socketPath)
			},
		}
		return &http.Client{Timeout: 5 * time.Second, Transport: transport}, "http://caddy-admin", "unix/" + socketPath + "|0600"
	}

	parsedURL, err := url.Parse(adminAddress)
	if err != nil || parsedURL.Host == "" {
		adminAddress = defaultAdminAddress
		parsedURL, _ = url.Parse(adminAddress)
	}
	return &http.Client{Timeout: 5 * time.Second}, strings.TrimRight(adminAddress, "/"), parsedURL.Host
}

func routeMatch(route ProxyRoute) map[string]any {
	switch route.RoutingType {
	case RoutingTypeDomain:
		return map[string]any{"host": []string{route.Domain}}
	case RoutingTypePath:
		return map[string]any{"path": []string{route.Path, route.Path + "/*"}}
	default:
		return map[string]any{}
	}
}

func routesToMap(routes []ProxyRoute) map[string]ProxyRoute {
	routeMap := make(map[string]ProxyRoute, len(routes))
	for _, route := range routes {
		routeMap[route.ID] = route
	}
	return routeMap
}

func copyRouteMap(routes map[string]ProxyRoute) map[string]ProxyRoute {
	copiedRoutes := make(map[string]ProxyRoute, len(routes))
	for id, route := range routes {
		copiedRoutes[id] = route
	}
	return copiedRoutes
}

func sortRoutes(routes []ProxyRoute) {
	sort.Slice(routes, func(firstIndex, secondIndex int) bool {
		firstRoute := routes[firstIndex]
		secondRoute := routes[secondIndex]
		if firstRoute.RoutingType != secondRoute.RoutingType {
			return firstRoute.RoutingType == RoutingTypeDomain
		}
		if firstRoute.RoutingType == RoutingTypePath && len(firstRoute.Path) != len(secondRoute.Path) {
			return len(firstRoute.Path) > len(secondRoute.Path)
		}
		if firstRoute.RoutingType == RoutingTypeDomain && firstRoute.Domain != secondRoute.Domain {
			return firstRoute.Domain < secondRoute.Domain
		}
		return firstRoute.ID < secondRoute.ID
	})
}
