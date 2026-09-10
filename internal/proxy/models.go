package proxy

import (
	"time"
)

type RoutingType string

const (
	RoutingTypeDomain RoutingType = "domain"
	RoutingTypePath   RoutingType = "path"
)

type RouteStatus string

const (
	StatusActive              RouteStatus = "ACTIVE"
	StatusDisabled            RouteStatus = "DISABLED"
	StatusUnhealthy           RouteStatus = "UNHEALTHY"
	StatusConfigError         RouteStatus = "CONFIG_ERROR"
	StatusTargetUnreachable   RouteStatus = "TARGET_UNREACHABLE"
	StatusVPNOffline          RouteStatus = "VPN_OFFLINE"
	StatusEndpointUnavailable RouteStatus = "PUBLIC_ENDPOINT_UNAVAILABLE"
)

type TargetPolicy struct {
	AllowedHosts  []string
	DeniedHosts   []string
	ReservedPorts []uint16
}

func defaultTargetPolicy() TargetPolicy {
	return TargetPolicy{
		AllowedHosts: []string{
			"localhost",
			"127.0.0.1",
			"::1",
		},
		DeniedHosts: []string{
			"metadata.google.internal",
		},
		ReservedPorts: []uint16{
			22,
			2019,
			2375,
			2376,
			5432,
			6379,
			8000,
			9090,
		},
	}
}

type ProxyRoute struct {
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	RoutingType    RoutingType `json:"routing_type"`
	Domain         string      `json:"domain"`
	Path           string      `json:"path"`
	Protocol       string      `json:"protocol"`
	TargetHost     string      `json:"target_host"`
	TargetPort     uint16      `json:"target_port"`
	Enabled        bool        `json:"enabled"`
	WebSocket      bool        `json:"websocket"`
	TLS            bool        `json:"tls"`
	HealthCheck    bool        `json:"health_check"`
	Status         RouteStatus `json:"status"`
	ResponseTimeMs int64       `json:"response_time_ms"`
	LastHealthAt   *time.Time  `json:"last_health_at,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type PublicEndpoint struct {
	PublicIP      string    `json:"public_ip"`
	ForwardedPort uint16    `json:"forwarded_port"`
	InternalPort  uint16    `json:"internal_port"`
	Protocol      string    `json:"protocol"`
	Status        string    `json:"status"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type RouteMetrics struct {
	RouteID           string    `json:"route_id"`
	TotalRequests     uint64    `json:"total_requests"`
	ActiveConnections uint32    `json:"active_connections"`
	BytesReceived     uint64    `json:"bytes_received"`
	BytesSent         uint64    `json:"bytes_sent"`
	AverageLatencyMs  float64   `json:"average_latency_ms"`
	ErrorCount        uint64    `json:"error_count"`
	LastSampledAt     time.Time `json:"last_sampled_at"`
}

type TargetProbeResult struct {
	Reachable  bool   `json:"reachable"`
	LatencyMs  int64  `json:"latency_ms"`
	StatusCode int    `json:"status_code"`
	Error      string `json:"error,omitempty"`
}

type ProxyStatus struct {
	EngineRunning   bool           `json:"engine_running"`
	EngineType      string         `json:"engine_type"`
	RoutesCount     int            `json:"routes_count"`
	ActiveRoutes    int            `json:"active_routes"`
	PublicEndpoint  PublicEndpoint `json:"public_endpoint"`
	LastReloadError string         `json:"last_reload_error,omitempty"`
	LastReloadedAt  time.Time      `json:"last_reloaded_at"`
}
