package proxy

import (
	"sync"
	"time"
)

type RouteMetricsRegistry struct {
	mutex   sync.RWMutex
	metrics map[string]RouteMetrics
}

func NewRouteMetricsRegistry() *RouteMetricsRegistry {
	return &RouteMetricsRegistry{
		metrics: make(map[string]RouteMetrics),
	}
}

func (r *RouteMetricsRegistry) GetRouteMetrics(routeID string) RouteMetrics {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if m, exists := r.metrics[routeID]; exists {
		return m
	}

	return RouteMetrics{
		RouteID:       routeID,
		LastSampledAt: time.Now(),
	}
}

func (r *RouteMetricsRegistry) GetAllMetrics() map[string]RouteMetrics {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	result := make(map[string]RouteMetrics, len(r.metrics))
	for k, v := range r.metrics {
		result[k] = v
	}
	return result
}

func (r *RouteMetricsRegistry) RecordRequest(routeID string, bytesRx, bytesTx uint64, latencyMs float64, isError bool) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	current, exists := r.metrics[routeID]
	if !exists {
		current = RouteMetrics{
			RouteID: routeID,
		}
	}

	current.TotalRequests++
	current.BytesReceived += bytesRx
	current.BytesSent += bytesTx
	if isError {
		current.ErrorCount++
	}

	// Rolling average calculation
	if current.TotalRequests > 1 {
		current.AverageLatencyMs = (current.AverageLatencyMs*float64(current.TotalRequests-1) + latencyMs) / float64(current.TotalRequests)
	} else {
		current.AverageLatencyMs = latencyMs
	}
	current.LastSampledAt = time.Now()

	r.metrics[routeID] = current
}

func (r *RouteMetricsRegistry) DeleteRoute(routeID string) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	delete(r.metrics, routeID)
}
