package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/qdm12/gluetun/internal/proxy"
)

type CreateRouteRequest struct {
	Name        string            `json:"name"`
	RoutingType proxy.RoutingType `json:"routing_type"`
	Domain      string            `json:"domain"`
	Path        string            `json:"path"`
	Protocol    string            `json:"protocol"`
	TargetHost  string            `json:"target_host"`
	TargetPort  uint16            `json:"target_port"`
	Enabled     *bool             `json:"enabled"`
	WebSocket   bool              `json:"websocket"`
	TLS         bool              `json:"tls"`
	HealthCheck *bool             `json:"health_check"`
}

type TestTargetRequest struct {
	TargetHost string `json:"target_host"`
	TargetPort uint16 `json:"target_port"`
}

func (h *APIHandler) handleProxyRoutes(writer http.ResponseWriter, request *http.Request) {
	if h.proxyManager == nil {
		writeError(writer, http.StatusServiceUnavailable, "PROXY_UNAVAILABLE", "Reverse proxy manager is not initialized", false)
		return
	}

	switch request.Method {
	case http.MethodGet:
		routes := h.proxyManager.ListRoutes()
		writeJSON(writer, http.StatusOK, routes)

	case http.MethodPost:
		var req CreateRouteRequest
		err := json.NewDecoder(request.Body).Decode(&req)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "INVALID_PAYLOAD", "Malformed JSON payload", false)
			return
		}

		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}

		healthCheck := true
		if req.HealthCheck != nil {
			healthCheck = *req.HealthCheck
		}

		newRoute := proxy.ProxyRoute{
			Name:        req.Name,
			RoutingType: req.RoutingType,
			Domain:      req.Domain,
			Path:        req.Path,
			Protocol:    req.Protocol,
			TargetHost:  req.TargetHost,
			TargetPort:  req.TargetPort,
			Enabled:     enabled,
			WebSocket:   req.WebSocket,
			TLS:         req.TLS,
			HealthCheck: healthCheck,
		}

		created, err := h.proxyManager.CreateRoute(request.Context(), newRoute)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "ROUTE_CREATION_FAILED", err.Error(), false)
			return
		}

		writeJSON(writer, http.StatusCreated, created)

	default:
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
	}
}

func (h *APIHandler) handleProxyRouteSubpath(writer http.ResponseWriter, request *http.Request) {
	if h.proxyManager == nil {
		writeError(writer, http.StatusServiceUnavailable, "PROXY_UNAVAILABLE", "Reverse proxy manager is not initialized", false)
		return
	}

	pathRemainder := strings.TrimPrefix(request.URL.Path, "/api/dashboard/proxy/routes/")
	if pathRemainder == "" {
		h.handleProxyRoutes(writer, request)
		return
	}

	if pathRemainder == "test-target" {
		h.handleProxyTestTarget(writer, request)
		return
	}

	parts := strings.Split(pathRemainder, "/")
	routeID := parts[0]

	if len(parts) == 2 {
		switch parts[1] {
		case "enable":
			if request.Method != http.MethodPost {
				writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
				return
			}
			err := h.proxyManager.EnableRoute(request.Context(), routeID)
			if err != nil {
				writeError(writer, http.StatusBadRequest, "ROUTE_ENABLE_FAILED", err.Error(), false)
				return
			}
			route, _, _ := h.proxyManager.GetRoute(routeID)
			writeJSON(writer, http.StatusOK, route)
			return

		case "disable":
			if request.Method != http.MethodPost {
				writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
				return
			}
			err := h.proxyManager.DisableRoute(request.Context(), routeID)
			if err != nil {
				writeError(writer, http.StatusBadRequest, "ROUTE_DISABLE_FAILED", err.Error(), false)
				return
			}
			route, _, _ := h.proxyManager.GetRoute(routeID)
			writeJSON(writer, http.StatusOK, route)
			return
		}
	}

	// Operations on /api/dashboard/proxy/routes/{id}
	switch request.Method {
	case http.MethodGet:
		route, metrics, exists := h.proxyManager.GetRoute(routeID)
		if !exists {
			writeError(writer, http.StatusNotFound, "ROUTE_NOT_FOUND", "Route not found", false)
			return
		}
		resp := map[string]any{
			"route":   route,
			"metrics": metrics,
		}
		writeJSON(writer, http.StatusOK, resp)

	case http.MethodPut:
		var req CreateRouteRequest
		err := json.NewDecoder(request.Body).Decode(&req)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "INVALID_PAYLOAD", "Malformed JSON payload", false)
			return
		}

		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}

		healthCheck := true
		if req.HealthCheck != nil {
			healthCheck = *req.HealthCheck
		}

		updatedRoute := proxy.ProxyRoute{
			ID:          routeID,
			Name:        req.Name,
			RoutingType: req.RoutingType,
			Domain:      req.Domain,
			Path:        req.Path,
			Protocol:    req.Protocol,
			TargetHost:  req.TargetHost,
			TargetPort:  req.TargetPort,
			Enabled:     enabled,
			WebSocket:   req.WebSocket,
			TLS:         req.TLS,
			HealthCheck: healthCheck,
		}

		saved, err := h.proxyManager.UpdateRoute(request.Context(), updatedRoute)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "ROUTE_UPDATE_FAILED", err.Error(), false)
			return
		}

		writeJSON(writer, http.StatusOK, saved)

	case http.MethodDelete:
		err := h.proxyManager.DeleteRoute(request.Context(), routeID)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "ROUTE_DELETE_FAILED", err.Error(), false)
			return
		}
		writeJSON(writer, http.StatusOK, map[string]string{"status": "deleted", "id": routeID})

	default:
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
	}
}

func (h *APIHandler) handleProxyTestTarget(writer http.ResponseWriter, request *http.Request) {
	if h.proxyManager == nil {
		writeError(writer, http.StatusServiceUnavailable, "PROXY_UNAVAILABLE", "Reverse proxy manager is not initialized", false)
		return
	}

	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	var req TestTargetRequest
	err := json.NewDecoder(request.Body).Decode(&req)
	if err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_PAYLOAD", "Malformed JSON payload", false)
		return
	}

	result := h.proxyManager.TestTarget(request.Context(), req.TargetHost, req.TargetPort)
	writeJSON(writer, http.StatusOK, result)
}

func (h *APIHandler) handleProxyStatus(writer http.ResponseWriter, request *http.Request) {
	if h.proxyManager == nil {
		writeError(writer, http.StatusServiceUnavailable, "PROXY_UNAVAILABLE", "Reverse proxy manager is not initialized", false)
		return
	}

	status := h.proxyManager.GetStatus(request.Context())
	writeJSON(writer, http.StatusOK, status)
}

func (h *APIHandler) handleProxyMetrics(writer http.ResponseWriter, request *http.Request) {
	if h.proxyManager == nil {
		writeError(writer, http.StatusServiceUnavailable, "PROXY_UNAVAILABLE", "Reverse proxy manager is not initialized", false)
		return
	}

	metrics := h.proxyManager.GetAllMetrics()
	writeJSON(writer, http.StatusOK, metrics)
}

func (h *APIHandler) handlePublicEndpoint(writer http.ResponseWriter, request *http.Request) {
	if h.proxyManager == nil {
		writeError(writer, http.StatusServiceUnavailable, "PROXY_UNAVAILABLE", "Reverse proxy manager is not initialized", false)
		return
	}

	endpoint := h.proxyManager.GetPublicEndpoint()
	writeJSON(writer, http.StatusOK, endpoint)
}
