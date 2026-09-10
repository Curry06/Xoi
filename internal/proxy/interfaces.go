package proxy

import (
	"context"
)

type ProxyProvider interface {
	CreateRoute(ctx context.Context, route ProxyRoute) error
	UpdateRoute(ctx context.Context, route ProxyRoute) error
	DeleteRoute(ctx context.Context, id string) error
	EnableRoute(ctx context.Context, id string) error
	DisableRoute(ctx context.Context, id string) error
	ListRoutes(ctx context.Context) ([]ProxyRoute, error)
	SyncRoutes(ctx context.Context, listenPort uint16, routes []ProxyRoute) error
	Ping(ctx context.Context) error
}

type HealthChecker interface {
	ProbeTarget(ctx context.Context, targetHost string, targetPort uint16) TargetProbeResult
	ProbeRoute(ctx context.Context, route ProxyRoute) TargetProbeResult
}

type MetricsCollector interface {
	GetRouteMetrics(routeID string) RouteMetrics
	RecordRequest(routeID string, bytesRx, bytesTx uint64, latencyMs float64, isError bool)
}
