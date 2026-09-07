package api

import (
	"net/http"
	"strings"

	"github.com/qdm12/gluetun/internal/dashboard/auth"
)

func NewRouter(handler *APIHandler, allowedOrigins []string) http.Handler {
	mux := http.NewServeMux()

	// Public auth routes
	mux.HandleFunc("/api/dashboard/auth/login", handler.handleAuthLogin)
	mux.HandleFunc("/api/dashboard/auth/logout", handler.handleAuthLogout)
	mux.HandleFunc("/api/dashboard/auth/session", handler.handleAuthSession)

	// Dashboard state & data routes
	mux.HandleFunc("/api/dashboard/bootstrap", handler.handleBootstrap)
	mux.HandleFunc("/api/dashboard/status", handler.handleStatus)
	mux.HandleFunc("/api/dashboard/capabilities", handler.handleCapabilities)
	mux.HandleFunc("/api/dashboard/servers", handler.handleServers)
	mux.HandleFunc("/api/dashboard/port-forwarding", handler.handlePortForwarding)
	mux.HandleFunc("/api/dashboard/traffic", handler.handleTraffic)
	mux.HandleFunc("/api/dashboard/history", handler.handleHistory)
	mux.HandleFunc("/api/dashboard/history/export", handler.handleDiagnosticsExport)
	mux.HandleFunc("/api/dashboard/events/stream", handler.handleEventsStream)

	// VPN control routes
	mux.HandleFunc("/api/dashboard/vpn/connect", handler.handleVPNConnect)
	mux.HandleFunc("/api/dashboard/vpn/disconnect", handler.handleVPNDisconnect)
	mux.HandleFunc("/api/dashboard/vpn/reconnect", handler.handleVPNReconnect)
	mux.HandleFunc("/api/dashboard/vpn/selection", handler.handleVPNSelection)
	mux.HandleFunc("/api/dashboard/endpoint/test", handler.handleEndpointTest)

	// Profiles routes with subpaths
	mux.HandleFunc("/api/dashboard/profiles", handler.handleProfiles)
	mux.HandleFunc("/api/dashboard/profiles/", func(writer http.ResponseWriter, request *http.Request) {
		trimmed := strings.TrimPrefix(request.URL.Path, "/api/dashboard/profiles/")
		if trimmed == "" {
			handler.handleProfiles(writer, request)
			return
		}

		if strings.HasSuffix(trimmed, "/apply") {
			profileID := strings.TrimSuffix(trimmed, "/apply")
			handler.handleProfileApply(writer, request, profileID)
			return
		}

		handler.handleProfileByID(writer, request, trimmed)
	})

	// Mock scenario switcher
	mux.HandleFunc("/api/dashboard/mock/scenario", handler.handleMockScenario)

	// Wrap in middleware chain
	var finalHandler http.Handler = mux
	finalHandler = authMiddleware(handler.authenticator, finalHandler)
	finalHandler = securityHeadersMiddleware(finalHandler)
	finalHandler = corsMiddleware(allowedOrigins, finalHandler)
	finalHandler = maxBytesMiddleware(1024*1024, finalHandler) // 1MB max body

	return finalHandler
}

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:;")
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		writer.Header().Set("X-Frame-Options", "DENY")
		writer.Header().Set("X-XSS-Protection", "1; mode=block")
		writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		next.ServeHTTP(writer, request)
	})
}

func corsMiddleware(allowedOrigins []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		origin := request.Header.Get("Origin")
		if origin != "" {
			allowed := false
			if len(allowedOrigins) == 0 {
				// Default allow standard localhost dev ports
				if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:") {
					allowed = true
				}
			} else {
				for _, allowedOrigin := range allowedOrigins {
					if allowedOrigin == "*" || allowedOrigin == origin {
						allowed = true
						break
					}
				}
			}

			if allowed {
				writer.Header().Set("Access-Control-Allow-Origin", origin)
				writer.Header().Set("Access-Control-Allow-Credentials", "true")
				writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With")
			}
		}

		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(writer, request)
	})
}

func maxBytesMiddleware(maxBytes int64, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Body != nil {
			request.Body = http.MaxBytesReader(writer, request.Body, maxBytes)
		}
		next.ServeHTTP(writer, request)
	})
}

func authMiddleware(authenticator *auth.Authenticator, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		// Only protect /api/dashboard routes
		if !strings.HasPrefix(request.URL.Path, "/api/dashboard") {
			next.ServeHTTP(writer, request)
			return
		}

		// Publicly accessible endpoints
		switch request.URL.Path {
		case "/api/dashboard/auth/login", "/api/dashboard/bootstrap", "/api/dashboard/status", "/api/dashboard/events/stream":
			next.ServeHTTP(writer, request)
			return
		}

		// Validate authentication and CSRF
		if authenticator.IsAuthRequired() {
			_, err := authenticator.ValidateRequest(request)
			if err != nil {
				if err == auth.ErrInvalidCSRFToken {
					writeError(writer, http.StatusForbidden, "INVALID_CSRF_TOKEN", err.Error(), false)
					return
				}
				writeError(writer, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", false)
				return
			}
		}

		next.ServeHTTP(writer, request)
	})
}
