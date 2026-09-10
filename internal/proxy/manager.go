package proxy

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

var errRouteAlreadyExists = errors.New("route already exists")

type Manager struct {
	store               *Store
	provider            ProxyProvider
	healthChecker       HealthChecker
	metrics             *RouteMetricsRegistry
	internalIngressPort uint16
	targetPolicy        TargetPolicy

	configurationMutex sync.Mutex
	endpointMutex      sync.RWMutex
	currentEndpoint    PublicEndpoint
	lastReloadError    string
	lastReloadedAt     time.Time
}

func NewManager(
	store *Store,
	provider ProxyProvider,
	healthChecker HealthChecker,
	internalIngressPort uint16,
) *Manager {
	if internalIngressPort == 0 {
		internalIngressPort = 8080
	}
	if healthChecker == nil {
		healthChecker = NewTargetHealthChecker(3 * time.Second)
	}

	return &Manager{
		store:               store,
		provider:            provider,
		healthChecker:       healthChecker,
		metrics:             NewRouteMetricsRegistry(),
		internalIngressPort: internalIngressPort,
		targetPolicy:        defaultTargetPolicy(),
		currentEndpoint: PublicEndpoint{
			InternalPort: internalIngressPort,
			Status:       "initializing",
			UpdatedAt:    time.Now(),
		},
	}
}

func (manager *Manager) SetTargetPolicy(targetPolicy TargetPolicy) {
	defaultPolicy := defaultTargetPolicy()
	targetPolicy.AllowedHosts = append(defaultPolicy.AllowedHosts, targetPolicy.AllowedHosts...)
	targetPolicy.DeniedHosts = append(defaultPolicy.DeniedHosts, targetPolicy.DeniedHosts...)
	targetPolicy.ReservedPorts = append(defaultPolicy.ReservedPorts, targetPolicy.ReservedPorts...)

	for index := range targetPolicy.AllowedHosts {
		targetPolicy.AllowedHosts[index] = strings.ToLower(strings.TrimSpace(targetPolicy.AllowedHosts[index]))
	}
	for index := range targetPolicy.DeniedHosts {
		targetPolicy.DeniedHosts[index] = strings.ToLower(strings.TrimSpace(targetPolicy.DeniedHosts[index]))
	}

	manager.configurationMutex.Lock()
	manager.targetPolicy = targetPolicy
	manager.configurationMutex.Unlock()
}

func (manager *Manager) Start(ctx context.Context, reconciliationInterval time.Duration) {
	if reconciliationInterval <= 0 {
		reconciliationInterval = 15 * time.Second
	}

	manager.reconcile(ctx)

	go func() {
		ticker := time.NewTicker(reconciliationInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				manager.reconcile(ctx)
				manager.runHealthChecks(ctx)
			}
		}
	}()
}

func (manager *Manager) ListRoutes() []ProxyRoute {
	routes := manager.store.List()
	for index := range routes {
		routes[index] = manager.withRuntimeStatus(routes[index])
	}
	return routes
}

func (manager *Manager) GetRoute(id string) (ProxyRoute, RouteMetrics, bool) {
	route, exists := manager.store.Get(id)
	if !exists {
		return ProxyRoute{}, RouteMetrics{}, false
	}
	return manager.withRuntimeStatus(route), manager.metrics.GetRouteMetrics(id), true
}

func (manager *Manager) CreateRoute(ctx context.Context, route ProxyRoute) (ProxyRoute, error) {
	manager.configurationMutex.Lock()
	defer manager.configurationMutex.Unlock()

	if route.ID != "" {
		return ProxyRoute{}, errRouteAlreadyExists
	}

	route = normalizeRoute(route)
	err := validateRouteWithPolicy(route, manager.targetPolicy)
	if err != nil {
		return ProxyRoute{}, fmt.Errorf("validating route: %w", err)
	}

	existingRoutes := manager.store.List()
	err = checkRouteCollisions(route, existingRoutes)
	if err != nil {
		return ProxyRoute{}, fmt.Errorf("checking route collision: %w", err)
	}

	now := time.Now()
	route.ID = generateRouteID()
	route.CreatedAt = now
	route.UpdatedAt = now
	route.Status = StatusActive
	candidateRoutes := append(existingRoutes, route)
	if err := manager.applyDesiredRoutes(ctx, existingRoutes, candidateRoutes); err != nil {
		return ProxyRoute{}, err
	}
	route = manager.updateRouteHealth(ctx, route)

	return manager.withRuntimeStatus(route), nil
}

func (manager *Manager) UpdateRoute(ctx context.Context, route ProxyRoute) (ProxyRoute, error) {
	manager.configurationMutex.Lock()
	defer manager.configurationMutex.Unlock()

	existingRoutes := manager.store.List()
	existingRoute, routeIndex := findRoute(existingRoutes, route.ID)
	if routeIndex == -1 {
		return ProxyRoute{}, errRouteNotFound
	}

	route = normalizeRoute(route)
	err := validateRouteWithPolicy(route, manager.targetPolicy)
	if err != nil {
		return ProxyRoute{}, fmt.Errorf("validating route: %w", err)
	}
	err = checkRouteCollisions(route, existingRoutes)
	if err != nil {
		return ProxyRoute{}, fmt.Errorf("checking route collision: %w", err)
	}

	route.CreatedAt = existingRoute.CreatedAt
	route.UpdatedAt = time.Now()
	route.Status = StatusActive
	candidateRoutes := append([]ProxyRoute(nil), existingRoutes...)
	candidateRoutes[routeIndex] = route
	if err := manager.applyDesiredRoutes(ctx, existingRoutes, candidateRoutes); err != nil {
		return ProxyRoute{}, err
	}
	route = manager.updateRouteHealth(ctx, route)

	return manager.withRuntimeStatus(route), nil
}

func (manager *Manager) DeleteRoute(ctx context.Context, id string) error {
	manager.configurationMutex.Lock()
	defer manager.configurationMutex.Unlock()

	existingRoutes := manager.store.List()
	_, routeIndex := findRoute(existingRoutes, id)
	if routeIndex == -1 {
		return errRouteNotFound
	}

	candidateRoutes := make([]ProxyRoute, 0, len(existingRoutes)-1)
	candidateRoutes = append(candidateRoutes, existingRoutes[:routeIndex]...)
	candidateRoutes = append(candidateRoutes, existingRoutes[routeIndex+1:]...)
	if err := manager.applyDesiredRoutes(ctx, existingRoutes, candidateRoutes); err != nil {
		return err
	}

	manager.metrics.DeleteRoute(id)
	return nil
}

func (manager *Manager) EnableRoute(ctx context.Context, id string) error {
	route, _, exists := manager.GetRoute(id)
	if !exists {
		return errRouteNotFound
	}
	route.Enabled = true
	_, err := manager.UpdateRoute(ctx, route)
	return err
}

func (manager *Manager) DisableRoute(ctx context.Context, id string) error {
	route, _, exists := manager.GetRoute(id)
	if !exists {
		return errRouteNotFound
	}
	route.Enabled = false
	_, err := manager.UpdateRoute(ctx, route)
	return err
}

func (manager *Manager) TestTarget(ctx context.Context, targetHost string, targetPort uint16) TargetProbeResult {
	manager.configurationMutex.Lock()
	targetPolicy := manager.targetPolicy
	manager.configurationMutex.Unlock()

	err := validateTarget(targetHost, targetPort, targetPolicy)
	if err != nil {
		return TargetProbeResult{Error: err.Error()}
	}
	return manager.healthChecker.ProbeTarget(ctx, targetHost, targetPort)
}

func (manager *Manager) UpdatePublicEndpoint(endpoint PublicEndpoint) {
	endpoint.InternalPort = manager.internalIngressPort

	manager.endpointMutex.Lock()
	defer manager.endpointMutex.Unlock()

	if manager.currentEndpoint.PublicIP == endpoint.PublicIP &&
		manager.currentEndpoint.ForwardedPort == endpoint.ForwardedPort &&
		manager.currentEndpoint.Protocol == endpoint.Protocol &&
		manager.currentEndpoint.Status == endpoint.Status {
		return
	}

	endpoint.UpdatedAt = time.Now()
	manager.currentEndpoint = endpoint
}

func (manager *Manager) GetPublicEndpoint() PublicEndpoint {
	manager.endpointMutex.RLock()
	defer manager.endpointMutex.RUnlock()
	return manager.currentEndpoint
}

func (manager *Manager) GetStatus(ctx context.Context) ProxyStatus {
	routes := manager.ListRoutes()
	activeCount := 0
	for _, route := range routes {
		if route.Status == StatusActive {
			activeCount++
		}
	}

	manager.endpointMutex.RLock()
	endpoint := manager.currentEndpoint
	lastReloadError := manager.lastReloadError
	lastReloadedAt := manager.lastReloadedAt
	manager.endpointMutex.RUnlock()

	return ProxyStatus{
		EngineRunning:   manager.provider.Ping(ctx) == nil,
		EngineType:      "caddy",
		RoutesCount:     len(routes),
		ActiveRoutes:    activeCount,
		PublicEndpoint:  endpoint,
		LastReloadError: lastReloadError,
		LastReloadedAt:  lastReloadedAt,
	}
}

func (manager *Manager) GetRouteMetrics(routeID string) RouteMetrics {
	return manager.metrics.GetRouteMetrics(routeID)
}

func (manager *Manager) GetAllMetrics() map[string]RouteMetrics {
	return manager.metrics.GetAllMetrics()
}

func (manager *Manager) RecordMetrics(routeID string, bytesRx, bytesTx uint64, latencyMs float64, isError bool) {
	manager.metrics.RecordRequest(routeID, bytesRx, bytesTx, latencyMs, isError)
}

func (manager *Manager) reconcile(ctx context.Context) {
	manager.configurationMutex.Lock()
	defer manager.configurationMutex.Unlock()

	routes := manager.store.List()
	routes = manager.applicableRoutes(routes)
	err := manager.provider.SyncRoutes(ctx, manager.internalIngressPort, routes)
	manager.setReloadResult(err)
}

func (manager *Manager) applyDesiredRoutes(ctx context.Context, previousRoutes, candidateRoutes []ProxyRoute) error {
	err := manager.provider.SyncRoutes(ctx, manager.internalIngressPort, candidateRoutes)
	if err != nil {
		manager.setReloadResult(err)
		return fmt.Errorf("applying route set to proxy provider: %w", err)
	}

	err = manager.store.Replace(candidateRoutes)
	if err == nil {
		manager.setReloadResult(nil)
		return nil
	}

	rollbackErr := manager.provider.SyncRoutes(ctx, manager.internalIngressPort, previousRoutes)
	if rollbackErr != nil {
		err = errors.Join(err, fmt.Errorf("restoring previous proxy route set: %w", rollbackErr))
	}
	manager.setReloadResult(err)
	return fmt.Errorf("persisting route set: %w", err)
}

func (manager *Manager) setReloadResult(err error) {
	manager.endpointMutex.Lock()
	defer manager.endpointMutex.Unlock()
	manager.lastReloadedAt = time.Now()
	if err == nil {
		manager.lastReloadError = ""
		return
	}
	manager.lastReloadError = err.Error()
}

func (manager *Manager) runHealthChecks(ctx context.Context) {
	routes := manager.store.List()
	for _, route := range routes {
		if !route.Enabled || !route.HealthCheck {
			continue
		}

		probeContext, cancel := context.WithTimeout(ctx, 3*time.Second)
		probe := manager.healthChecker.ProbeRoute(probeContext, route)
		cancel()

		status := StatusActive
		if !probe.Reachable {
			status = StatusTargetUnreachable
		}
		manager.store.UpdateStatus(route.ID, status, probe.LatencyMs)
	}
}

func (manager *Manager) updateRouteHealth(ctx context.Context, route ProxyRoute) ProxyRoute {
	if !route.Enabled {
		route.Status = StatusDisabled
		return route
	}
	if !route.HealthCheck {
		route.Status = StatusActive
		return route
	}

	probe := manager.healthChecker.ProbeRoute(ctx, route)
	now := time.Now()
	route.LastHealthAt = &now
	route.ResponseTimeMs = probe.LatencyMs
	if probe.Reachable {
		route.Status = StatusActive
		manager.store.UpdateStatus(route.ID, route.Status, route.ResponseTimeMs)
		return route
	}
	route.Status = StatusTargetUnreachable
	manager.store.UpdateStatus(route.ID, route.Status, route.ResponseTimeMs)
	return route
}

func (manager *Manager) withRuntimeStatus(route ProxyRoute) ProxyRoute {
	if !route.Enabled {
		route.Status = StatusDisabled
		return route
	}
	if err := validateRouteWithPolicy(route, manager.targetPolicy); err != nil {
		route.Status = StatusConfigError
		return route
	}

	endpoint := manager.GetPublicEndpoint()
	switch endpoint.Status {
	case "active":
		return route
	case "vpn_offline":
		route.Status = StatusVPNOffline
	default:
		route.Status = StatusEndpointUnavailable
	}
	return route
}

func (manager *Manager) applicableRoutes(routes []ProxyRoute) []ProxyRoute {
	applicableRoutes := make([]ProxyRoute, 0, len(routes))
	for _, route := range routes {
		if err := validateRouteWithPolicy(route, manager.targetPolicy); err == nil {
			applicableRoutes = append(applicableRoutes, route)
		}
	}
	return applicableRoutes
}

func normalizeRoute(route ProxyRoute) ProxyRoute {
	route.Name = strings.TrimSpace(route.Name)
	route.Domain = strings.ToLower(strings.TrimSpace(route.Domain))
	route.Path = strings.TrimSpace(route.Path)
	if route.Path != "/" {
		route.Path = strings.TrimRight(route.Path, "/")
	}
	route.Protocol = strings.ToLower(strings.TrimSpace(route.Protocol))
	route.TargetHost = strings.ToLower(strings.TrimSpace(route.TargetHost))
	return route
}

func findRoute(routes []ProxyRoute, routeID string) (ProxyRoute, int) {
	for index, route := range routes {
		if route.ID == routeID {
			return route, index
		}
	}
	return ProxyRoute{}, -1
}
