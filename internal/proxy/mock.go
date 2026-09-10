package proxy

import (
	"context"
	"errors"
	"sync"
)

type MockProvider struct {
	mutex      sync.RWMutex
	routes     map[string]ProxyRoute
	listenPort uint16
	failPing   bool
	failSync   bool
}

func NewMockProvider(listenPort uint16) *MockProvider {
	if listenPort == 0 {
		listenPort = 8080
	}
	return &MockProvider{
		routes:     make(map[string]ProxyRoute),
		listenPort: listenPort,
	}
}

func (m *MockProvider) SetFailPing(fail bool) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.failPing = fail
}

func (m *MockProvider) SetFailSync(fail bool) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.failSync = fail
}

func (m *MockProvider) Ping(_ context.Context) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	if m.failPing {
		return errors.New("simulated mock ping failure")
	}
	return nil
}

func (m *MockProvider) SyncRoutes(_ context.Context, listenPort uint16, routes []ProxyRoute) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.failSync {
		return errors.New("simulated mock sync failure")
	}
	if listenPort > 0 {
		m.listenPort = listenPort
	}
	m.routes = make(map[string]ProxyRoute, len(routes))
	for _, r := range routes {
		m.routes[r.ID] = r
	}
	return nil
}

func (m *MockProvider) CreateRoute(_ context.Context, route ProxyRoute) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.failSync {
		return errors.New("simulated mock create failure")
	}
	m.routes[route.ID] = route
	return nil
}

func (m *MockProvider) UpdateRoute(_ context.Context, route ProxyRoute) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.failSync {
		return errors.New("simulated mock update failure")
	}
	m.routes[route.ID] = route
	return nil
}

func (m *MockProvider) DeleteRoute(_ context.Context, id string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	delete(m.routes, id)
	return nil
}

func (m *MockProvider) EnableRoute(_ context.Context, id string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if r, exists := m.routes[id]; exists {
		r.Enabled = true
		m.routes[id] = r
	}
	return nil
}

func (m *MockProvider) DisableRoute(_ context.Context, id string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if r, exists := m.routes[id]; exists {
		r.Enabled = false
		m.routes[id] = r
	}
	return nil
}

func (m *MockProvider) ListRoutes(_ context.Context) ([]ProxyRoute, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	routesList := make([]ProxyRoute, 0, len(m.routes))
	for _, r := range m.routes {
		routesList = append(routesList, r)
	}
	return routesList, nil
}
