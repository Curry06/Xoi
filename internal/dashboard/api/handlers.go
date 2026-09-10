package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/qdm12/gluetun/internal/configuration/settings"
	"github.com/qdm12/gluetun/internal/constants"
	"github.com/qdm12/gluetun/internal/constants/providers"
	"github.com/qdm12/gluetun/internal/constants/vpn"
	"github.com/qdm12/gluetun/internal/dashboard/auth"
	"github.com/qdm12/gluetun/internal/dashboard/gluetun"
	"github.com/qdm12/gluetun/internal/dashboard/history"
	"github.com/qdm12/gluetun/internal/dashboard/notify"
	"github.com/qdm12/gluetun/internal/dashboard/profiles"
	"github.com/qdm12/gluetun/internal/dashboard/state"
	"github.com/qdm12/gluetun/internal/models"
	"github.com/qdm12/gluetun/internal/storage"
)

type ServerResponse struct {
	VPN         string   `json:"vpn"`
	Country     string   `json:"country"`
	Region      string   `json:"region,omitempty"`
	City        string   `json:"city,omitempty"`
	Hostname    string   `json:"hostname"`
	ServerName  string   `json:"server_name,omitempty"`
	Number      uint16   `json:"number,omitempty"`
	TCP         bool     `json:"tcp"`
	UDP         bool     `json:"udp"`
	PortForward bool     `json:"port_forward"`
	SecureCore  bool     `json:"secure_core"`
	Tor         bool     `json:"tor"`
	Stream      bool     `json:"stream"`
	IPs         []string `json:"ips"`
}

type APIHandler struct {
	coordinator      *state.Coordinator
	authenticator    *auth.Authenticator
	serverStorage    *storage.Storage
	client           gluetun.Client
	telegramNotifier *notify.TelegramNotifier
}

func (h *APIHandler) SetTelegramNotifier(notifier *notify.TelegramNotifier) {
	h.telegramNotifier = notifier
}

func NewAPIHandler(
	coordinator *state.Coordinator,
	authenticator *auth.Authenticator,
	serverStorage *storage.Storage,
) *APIHandler {
	return &APIHandler{
		coordinator:   coordinator,
		authenticator: authenticator,
		serverStorage: serverStorage,
		client:        coordinator.Client(),
	}
}

// Bootstrap provides initial payload to avoid waterfall requests on dashboard load.
func (h *APIHandler) handleBootstrap(writer http.ResponseWriter, request *http.Request) {
	snapshot := h.coordinator.GetSnapshot()
	profilesList := h.coordinator.Profiles().List()

	session, err := h.authenticator.ValidateRequest(request)
	isAuthenticated := err == nil

	bootstrapData := map[string]any{
		"authenticated":  isAuthenticated,
		"auth_required":  h.authenticator.IsAuthRequired(),
		"username":       session.Username,
		"snapshot":       snapshot,
		"capabilities":   h.client.GetCapabilities(),
		"is_mock":        h.client.IsMock(),
		"profiles_count": len(profilesList),
		"server_time":    time.Now().UTC(),
	}

	writeJSON(writer, http.StatusOK, bootstrapData)
}

func (h *APIHandler) handleStatus(writer http.ResponseWriter, request *http.Request) {
	snapshot := h.coordinator.GetSnapshot()
	writeJSON(writer, http.StatusOK, snapshot)
}

func (h *APIHandler) handleCapabilities(writer http.ResponseWriter, request *http.Request) {
	capabilities := h.client.GetCapabilities()
	writeJSON(writer, http.StatusOK, capabilities)
}

func (h *APIHandler) handlePortForwarding(writer http.ResponseWriter, request *http.Request) {
	snapshot := h.coordinator.GetSnapshot()
	writeJSON(writer, http.StatusOK, snapshot.PortForwarding)
}

func (h *APIHandler) handleTraffic(writer http.ResponseWriter, request *http.Request) {
	snapshot := h.coordinator.GetSnapshot()
	writeJSON(writer, http.StatusOK, snapshot.Traffic)
}

func (h *APIHandler) handleHistory(writer http.ResponseWriter, request *http.Request) {
	eventType := history.EventType(request.URL.Query().Get("type"))
	severity := request.URL.Query().Get("severity")
	limitStr := request.URL.Query().Get("limit")

	limit := 100
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	events := h.coordinator.History().ListEvents(history.Filter{
		Type:     eventType,
		Severity: severity,
		Limit:    limit,
	})

	writeJSON(writer, http.StatusOK, events)
}

func (h *APIHandler) handleDiagnosticsExport(writer http.ResponseWriter, request *http.Request) {
	data, err := h.coordinator.History().ExportDiagnostics()
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "EXPORT_FAILED", "Failed exporting diagnostics", false)
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.Header().Set("Content-Disposition", "attachment; filename=gluetun-diagnostics.json")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(data)
}

func (h *APIHandler) handleServers(writer http.ResponseWriter, request *http.Request) {
	providerName := request.URL.Query().Get("provider")
	if providerName == "" {
		providerName = providers.Protonvpn
	}

	countryFilter := strings.ToLower(request.URL.Query().Get("country"))
	cityFilter := strings.ToLower(request.URL.Query().Get("city"))
	hostnameFilter := strings.ToLower(request.URL.Query().Get("hostname"))
	protocolFilter := strings.ToLower(request.URL.Query().Get("protocol"))
	portForwardOnly := request.URL.Query().Get("port_forward") == "true"
	secureCoreOnly := request.URL.Query().Get("secure_core") == "true"
	torOnly := request.URL.Query().Get("tor") == "true"
	streamOnly := request.URL.Query().Get("stream") == "true"

	var rawServers []models.Server
	if h.serverStorage != nil {
		rawServers = h.serverStorage.GetServers(providerName)
	}

	// Fallback to mock servers if storage has none or in mock mode
	if len(rawServers) == 0 {
		rawServers = generateMockServers()
	}

	results := make([]ServerResponse, 0, 100)
	for _, srv := range rawServers {
		if countryFilter != "" && !strings.Contains(strings.ToLower(srv.Country), countryFilter) {
			continue
		}
		if cityFilter != "" && !strings.Contains(strings.ToLower(srv.City), cityFilter) {
			continue
		}
		if hostnameFilter != "" && !strings.Contains(strings.ToLower(srv.Hostname), hostnameFilter) {
			continue
		}
		if protocolFilter == "wireguard" && srv.VPN != vpn.Wireguard {
			continue
		}
		if protocolFilter == "openvpn" && srv.VPN != vpn.OpenVPN {
			continue
		}
		if portForwardOnly && !srv.PortForward {
			continue
		}
		if secureCoreOnly && !srv.SecureCore {
			continue
		}
		if torOnly && !srv.Tor {
			continue
		}
		if streamOnly && !srv.Stream {
			continue
		}

		ipStrings := make([]string, len(srv.IPs))
		for index, ip := range srv.IPs {
			ipStrings[index] = ip.String()
		}

		results = append(results, ServerResponse{
			VPN:         srv.VPN,
			Country:     srv.Country,
			Region:      srv.Region,
			City:        srv.City,
			Hostname:    srv.Hostname,
			ServerName:  srv.ServerName,
			Number:      srv.Number,
			TCP:         srv.TCP,
			UDP:         srv.UDP,
			PortForward: srv.PortForward,
			SecureCore:  srv.SecureCore,
			Tor:         srv.Tor,
			Stream:      srv.Stream,
			IPs:         ipStrings,
		})

		// Cap return limit at 250 servers to keep responses snappy
		if len(results) >= 250 {
			break
		}
	}

	writeJSON(writer, http.StatusOK, results)
}

func (h *APIHandler) handleProfiles(writer http.ResponseWriter, request *http.Request) {
	switch request.Method {
	case http.MethodGet:
		profilesList := h.coordinator.Profiles().List()
		writeJSON(writer, http.StatusOK, profilesList)

	case http.MethodPost:
		var profile profiles.Profile
		if err := json.NewDecoder(request.Body).Decode(&profile); err != nil {
			writeError(writer, http.StatusBadRequest, "INVALID_REQUEST", "Invalid JSON body", false)
			return
		}

		created, err := h.coordinator.Profiles().Create(profile)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "VALIDATION_FAILED", err.Error(), false)
			return
		}

		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventAudit,
			Severity: "info",
			Title:    "Profile Created",
			Message:  fmt.Sprintf("Created profile '%s'", created.Name),
		})

		writeJSON(writer, http.StatusCreated, created)

	default:
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
	}
}

func (h *APIHandler) handleProfileByID(writer http.ResponseWriter, request *http.Request, profileID string) {
	switch request.Method {
	case http.MethodGet:
		profile, exists := h.coordinator.Profiles().Get(profileID)
		if !exists {
			writeError(writer, http.StatusNotFound, "NOT_FOUND", "Profile not found", false)
			return
		}
		writeJSON(writer, http.StatusOK, profile)

	case http.MethodPut:
		var updated profiles.Profile
		if err := json.NewDecoder(request.Body).Decode(&updated); err != nil {
			writeError(writer, http.StatusBadRequest, "INVALID_REQUEST", "Invalid JSON body", false)
			return
		}

		saved, err := h.coordinator.Profiles().Update(profileID, updated)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "VALIDATION_FAILED", err.Error(), false)
			return
		}

		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventAudit,
			Severity: "info",
			Title:    "Profile Updated",
			Message:  fmt.Sprintf("Updated profile '%s'", saved.Name),
		})

		writeJSON(writer, http.StatusOK, saved)

	case http.MethodDelete:
		err := h.coordinator.Profiles().Delete(profileID)
		if err != nil {
			writeError(writer, http.StatusNotFound, "NOT_FOUND", "Profile not found", false)
			return
		}

		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventAudit,
			Severity: "info",
			Title:    "Profile Deleted",
			Message:  fmt.Sprintf("Deleted profile %s", profileID),
		})

		writeJSON(writer, http.StatusOK, map[string]string{"message": "deleted"})

	default:
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
	}
}

func (h *APIHandler) handleProfileApply(writer http.ResponseWriter, request *http.Request, profileID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	profile, exists := h.coordinator.Profiles().Get(profileID)
	if !exists {
		writeError(writer, http.StatusNotFound, "NOT_FOUND", "Profile not found", false)
		return
	}

	unlock, ok := h.coordinator.TryLockOperation("apply_profile")
	if !ok {
		writeError(writer, http.StatusConflict, "OPERATION_IN_PROGRESS", "Another VPN operation is currently in progress", true)
		return
	}
	defer unlock()

	ctx, cancel := context.WithTimeout(request.Context(), 30*time.Second)
	defer cancel()

	// Convert profile to settings override
	vpnType := vpn.Wireguard
	if strings.HasPrefix(profile.Protocol, "openvpn") {
		vpnType = vpn.OpenVPN
	}

	serverSelection := settings.ServerSelection{
		VPN: vpnType,
	}
	if profile.Country != "" {
		serverSelection.Countries = []string{profile.Country}
	}
	if profile.City != "" {
		serverSelection.Cities = []string{profile.City}
	}
	if profile.Hostname != "" {
		serverSelection.Hostnames = []string{profile.Hostname}
	}
	if profile.PortForwarding {
		serverSelection.PortForwardOnly = new(bool)
		*serverSelection.PortForwardOnly = true
	}

	overrideSettings := settings.VPN{
		Type: vpnType,
		Provider: settings.Provider{
			Name:            profile.Provider,
			ServerSelection: serverSelection,
		},
	}

	outcome, err := h.client.SetVPNSettings(ctx, overrideSettings)
	if err != nil {
		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventAudit,
			Severity: "error",
			Title:    "Profile Apply Failed",
			Message:  fmt.Sprintf("Failed applying profile '%s': %s", profile.Name, err.Error()),
		})
		writeError(writer, http.StatusInternalServerError, "VPN_OPERATION_FAILED", fmt.Sprintf("Failed applying profile: %s", err.Error()), true)
		return
	}

	h.coordinator.Profiles().MarkUsed(profileID)
	h.coordinator.History().AddEvent(history.HistoryEvent{
		Type:     history.EventAudit,
		Severity: "info",
		Title:    "Profile Applied",
		Message:  fmt.Sprintf("Applied profile '%s' (outcome: %s)", profile.Name, outcome),
	})

	snapshot := h.coordinator.Refresh(ctx)
	writeJSON(writer, http.StatusOK, map[string]any{
		"outcome":  outcome,
		"snapshot": snapshot,
	})
}

type ConfirmRequest struct {
	Confirmed bool `json:"confirmed"`
}

func (h *APIHandler) handleVPNConnect(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	clientIP := auth.ExtractClientIP(request)
	if !h.authenticator.AllowControlAction(clientIP) {
		writeError(writer, http.StatusTooManyRequests, "RATE_LIMITED", "Too many control requests, please slow down", true)
		return
	}

	unlock, ok := h.coordinator.TryLockOperation("connect")
	if !ok {
		writeError(writer, http.StatusConflict, "OPERATION_IN_PROGRESS", "Another VPN operation is currently in progress", true)
		return
	}
	defer unlock()

	ctx, cancel := context.WithTimeout(request.Context(), 15*time.Second)
	defer cancel()

	outcome, err := h.client.SetVPNStatus(ctx, constants.Running)
	if err != nil {
		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventAudit,
			Severity: "error",
			Title:    "Connect Failed",
			Message:  err.Error(),
		})
		writeError(writer, http.StatusInternalServerError, "VPN_OPERATION_FAILED", fmt.Sprintf("Failed starting VPN: %s", err.Error()), true)
		return
	}

	h.coordinator.History().AddEvent(history.HistoryEvent{
		Type:     history.EventAudit,
		Severity: "info",
		Title:    "VPN Connect Initiated",
		Message:  outcome,
	})

	snapshot := h.coordinator.Refresh(ctx)
	writeJSON(writer, http.StatusOK, map[string]any{
		"outcome":  outcome,
		"snapshot": snapshot,
	})
}

func (h *APIHandler) handleVPNDisconnect(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	var req ConfirmRequest
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil || !req.Confirmed {
		writeError(writer, http.StatusBadRequest, "CONFIRMATION_REQUIRED", "Disconnect requires explicit confirmation", false)
		return
	}

	clientIP := auth.ExtractClientIP(request)
	if !h.authenticator.AllowControlAction(clientIP) {
		writeError(writer, http.StatusTooManyRequests, "RATE_LIMITED", "Too many control requests, please slow down", true)
		return
	}

	unlock, ok := h.coordinator.TryLockOperation("disconnect")
	if !ok {
		writeError(writer, http.StatusConflict, "OPERATION_IN_PROGRESS", "Another VPN operation is currently in progress", true)
		return
	}
	defer unlock()

	ctx, cancel := context.WithTimeout(request.Context(), 15*time.Second)
	defer cancel()

	outcome, err := h.client.SetVPNStatus(ctx, constants.Stopped)
	if err != nil {
		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventAudit,
			Severity: "error",
			Title:    "Disconnect Failed",
			Message:  err.Error(),
		})
		writeError(writer, http.StatusInternalServerError, "VPN_OPERATION_FAILED", fmt.Sprintf("Failed stopping VPN: %s", err.Error()), true)
		return
	}

	h.coordinator.History().AddEvent(history.HistoryEvent{
		Type:     history.EventAudit,
		Severity: "warn",
		Title:    "VPN Disconnected",
		Message:  "VPN tunnel manually stopped by user",
	})

	snapshot := h.coordinator.Refresh(ctx)
	writeJSON(writer, http.StatusOK, map[string]any{
		"outcome":  outcome,
		"snapshot": snapshot,
	})
}

func (h *APIHandler) handleVPNReconnect(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	var req ConfirmRequest
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil || !req.Confirmed {
		writeError(writer, http.StatusBadRequest, "CONFIRMATION_REQUIRED", "Reconnect requires explicit confirmation", false)
		return
	}

	clientIP := auth.ExtractClientIP(request)
	if !h.authenticator.AllowControlAction(clientIP) {
		writeError(writer, http.StatusTooManyRequests, "RATE_LIMITED", "Too many control requests, please slow down", true)
		return
	}

	unlock, ok := h.coordinator.TryLockOperation("reconnect")
	if !ok {
		writeError(writer, http.StatusConflict, "OPERATION_IN_PROGRESS", "Another VPN operation is currently in progress", true)
		return
	}
	defer unlock()

	ctx, cancel := context.WithTimeout(request.Context(), 25*time.Second)
	defer cancel()

	// Stop, then start
	_, _ = h.client.SetVPNStatus(ctx, constants.Stopped)
	outcome, err := h.client.SetVPNStatus(ctx, constants.Running)
	if err != nil {
		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventAudit,
			Severity: "error",
			Title:    "Reconnect Failed",
			Message:  err.Error(),
		})
		writeError(writer, http.StatusInternalServerError, "VPN_OPERATION_FAILED", fmt.Sprintf("Failed reconnecting VPN: %s", err.Error()), true)
		return
	}

	h.coordinator.History().AddEvent(history.HistoryEvent{
		Type:     history.EventAudit,
		Severity: "info",
		Title:    "VPN Reconnected",
		Message:  outcome,
	})

	snapshot := h.coordinator.Refresh(ctx)
	writeJSON(writer, http.StatusOK, map[string]any{
		"outcome":  outcome,
		"snapshot": snapshot,
	})
}

type ServerSelectionRequest struct {
	Confirmed bool   `json:"confirmed"`
	Provider  string `json:"provider"`
	Country   string `json:"country,omitempty"`
	City      string `json:"city,omitempty"`
	Hostname  string `json:"hostname,omitempty"`
	Protocol  string `json:"protocol,omitempty"` // "wireguard" or "openvpn"
}

func (h *APIHandler) handleVPNSelection(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPut && request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	capabilities := h.client.GetCapabilities()
	if !capabilities.CanSwitchServerRuntime {
		writeJSON(writer, http.StatusOK, map[string]any{
			"supported": false,
			"reason":    "Runtime server switching is not supported by this Gluetun version or environment.",
		})
		return
	}

	var req ServerSelectionRequest
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_REQUEST", "Invalid JSON payload", false)
		return
	}

	if !req.Confirmed {
		writeError(writer, http.StatusBadRequest, "CONFIRMATION_REQUIRED", "Server change requires explicit confirmation", false)
		return
	}

	if req.Provider == "" {
		req.Provider = providers.Protonvpn
	}

	clientIP := auth.ExtractClientIP(request)
	if !h.authenticator.AllowControlAction(clientIP) {
		writeError(writer, http.StatusTooManyRequests, "RATE_LIMITED", "Too many control requests, please slow down", true)
		return
	}

	unlock, ok := h.coordinator.TryLockOperation("change_server")
	if !ok {
		writeError(writer, http.StatusConflict, "OPERATION_IN_PROGRESS", "Another VPN operation is currently in progress", true)
		return
	}
	defer unlock()

	ctx, cancel := context.WithTimeout(request.Context(), 30*time.Second)
	defer cancel()

	vpnType := vpn.Wireguard
	if strings.ToLower(req.Protocol) == "openvpn" {
		vpnType = vpn.OpenVPN
	}

	serverSelection := settings.ServerSelection{
		VPN: vpnType,
	}
	if req.Country != "" {
		serverSelection.Countries = []string{req.Country}
	}
	if req.City != "" {
		serverSelection.Cities = []string{req.City}
	}
	if req.Hostname != "" {
		serverSelection.Hostnames = []string{req.Hostname}
	}

	overrideSettings := settings.VPN{
		Type: vpnType,
		Provider: settings.Provider{
			Name:            req.Provider,
			ServerSelection: serverSelection,
		},
	}

	outcome, err := h.client.SetVPNSettings(ctx, overrideSettings)
	if err != nil {
		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventAudit,
			Severity: "error",
			Title:    "Server Switch Failed",
			Message:  err.Error(),
		})
		writeError(writer, http.StatusInternalServerError, "VPN_OPERATION_FAILED", fmt.Sprintf("Failed changing server: %s", err.Error()), true)
		return
	}

	h.coordinator.History().AddEvent(history.HistoryEvent{
		Type:     history.EventAudit,
		Severity: "info",
		Title:    "Server Changed",
		Message:  fmt.Sprintf("Switched to %s (%s)", req.Country, req.Hostname),
	})

	snapshot := h.coordinator.Refresh(ctx)
	writeJSON(writer, http.StatusOK, map[string]any{
		"supported": true,
		"outcome":   outcome,
		"snapshot":  snapshot,
	})
}

func (h *APIHandler) handleEndpointTest(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	snapshot := h.coordinator.GetSnapshot()
	if !snapshot.PortForwarding.Available || snapshot.PortForwarding.Port == 0 || snapshot.PortForwarding.PublicIP == "" {
		writeJSON(writer, http.StatusOK, map[string]any{
			"reachable": false,
			"port":      0,
			"message":   "No active forwarded port available for testing.",
			"tested_at": time.Now().UTC(),
		})
		return
	}

	port := snapshot.PortForwarding.Port
	publicIP := snapshot.PortForwarding.PublicIP

	// In mock mode: simulate successful reachability check
	if h.client.IsMock() {
		h.coordinator.History().AddEvent(history.HistoryEvent{
			Type:     history.EventHealthCheck,
			Severity: "info",
			Title:    "Endpoint Reachability Check",
			Message:  fmt.Sprintf("Verified external reachability on %s:%d (Mock)", publicIP, port),
		})
		writeJSON(writer, http.StatusOK, map[string]any{
			"reachable": true,
			"endpoint":  fmt.Sprintf("%s:%d", publicIP, port),
			"port":      port,
			"message":   "Endpoint is reachable from test probe.",
			"tested_at": time.Now().UTC(),
		})
		return
	}

	// Real network probe test with short timeout
	endpoint := fmt.Sprintf("%s:%d", publicIP, port)
	conn, err := net.DialTimeout("tcp", endpoint, 3*time.Second)
	reachable := err == nil
	if err == nil {
		_ = conn.Close()
	}

	message := "Port is open and responsive."
	if !reachable {
		message = fmt.Sprintf("Probe failed: %s", err.Error())
	}

	h.coordinator.History().AddEvent(history.HistoryEvent{
		Type:     history.EventHealthCheck,
		Severity: ternary(reachable, "info", "warn"),
		Title:    "Endpoint Reachability Check",
		Message:  fmt.Sprintf("Test on %s: %s", endpoint, message),
	})

	writeJSON(writer, http.StatusOK, map[string]any{
		"reachable": reachable,
		"endpoint":  endpoint,
		"port":      port,
		"message":   message,
		"tested_at": time.Now().UTC(),
	})
}

// handleEventsStream handles Server-Sent Events (SSE) live updates.
func (h *APIHandler) handleEventsStream(writer http.ResponseWriter, request *http.Request) {
	flusher, ok := writer.(http.Flusher)
	if !ok {
		writeError(writer, http.StatusInternalServerError, "STREAMING_UNSUPPORTED", "Streaming not supported", false)
		return
	}

	writer.Header().Set("Content-Type", "text/event-stream")
	writer.Header().Set("Cache-Control", "no-cache")
	writer.Header().Set("Connection", "keep-alive")
	writer.Header().Set("X-Accel-Buffering", "no")

	ch := h.coordinator.Subscribe()
	defer h.coordinator.Unsubscribe(ch)

	notify := request.Context().Done()

	for {
		select {
		case <-notify:
			return
		case snapshot, ok := <-ch:
			if !ok {
				return
			}
			data, err := json.Marshal(snapshot)
			if err != nil {
				continue
			}
			_, err = fmt.Fprintf(writer, "event: status\ndata: %s\n\n", string(data))
			if err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *APIHandler) handleAuthLogin(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", false)
		return
	}

	clientIP := auth.ExtractClientIP(request)
	session, err := h.authenticator.Login(clientIP, req.Username, req.Password)
	if err != nil {
		if err == auth.ErrRateLimited {
			writeError(writer, http.StatusTooManyRequests, "RATE_LIMITED", err.Error(), true)
			return
		}
		writeError(writer, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid username or password", false)
		return
	}

	// Set secure HTTP-only cookie
	http.SetCookie(writer, &http.Cookie{
		Name:     "gluetun_session",
		Value:    session.Token,
		Path:     "/",
		Expires:  session.ExpiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	writeJSON(writer, http.StatusOK, map[string]any{
		"token":      session.Token,
		"csrf_token": session.CSRFToken,
		"username":   session.Username,
		"expires_at": session.ExpiresAt,
	})
}

func (h *APIHandler) handleAuthLogout(writer http.ResponseWriter, request *http.Request) {
	h.authenticator.Logout(request)
	http.SetCookie(writer, &http.Cookie{
		Name:     "gluetun_session",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	writeJSON(writer, http.StatusOK, map[string]string{"message": "logged out"})
}

func (h *APIHandler) handleAuthSession(writer http.ResponseWriter, request *http.Request) {
	session, err := h.authenticator.ValidateRequest(request)
	if err != nil {
		writeError(writer, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated", false)
		return
	}

	writeJSON(writer, http.StatusOK, map[string]any{
		"authenticated": true,
		"username":      session.Username,
		"csrf_token":    session.CSRFToken,
	})
}

type ScenarioRequest struct {
	Scenario string `json:"scenario"`
}

func (h *APIHandler) handleMockScenario(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	mockClient, isMock := h.client.(*gluetun.MockClient)
	if !isMock {
		writeError(writer, http.StatusForbidden, "MOCK_DISABLED", "Mock scenario switcher is only available in mock mode", false)
		return
	}

	var req ScenarioRequest
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil || req.Scenario == "" {
		writeError(writer, http.StatusBadRequest, "INVALID_REQUEST", "Scenario must be provided", false)
		return
	}

	mockClient.SetScenario(req.Scenario)
	snapshot := h.coordinator.Refresh(request.Context())

	writeJSON(writer, http.StatusOK, map[string]any{
		"scenario": req.Scenario,
		"snapshot": snapshot,
	})
}

func ternary(condition bool, ifTrue, ifFalse string) string {
	if condition {
		return ifTrue
	}
	return ifFalse
}

func generateMockServers() []models.Server {
	return []models.Server{
		{
			VPN:         vpn.Wireguard,
			Country:     "Switzerland",
			Region:      "Zurich",
			City:        "Zurich",
			Hostname:    "ch-01.protonvpn.net",
			PortForward: true,
			Stream:      true,
			UDP:         true,
		},
		{
			VPN:         vpn.Wireguard,
			Country:     "Iceland",
			Region:      "Reykjavik",
			City:        "Reykjavik",
			Hostname:    "is-01.protonvpn.net",
			PortForward: true,
			Stream:      true,
			UDP:         true,
		},
		{
			VPN:         vpn.Wireguard,
			Country:     "Sweden",
			Region:      "Stockholm",
			City:        "Stockholm",
			Hostname:    "se-01.protonvpn.net",
			PortForward: true,
			Tor:         true,
			UDP:         true,
		},
		{
			VPN:         vpn.OpenVPN,
			Country:     "India",
			Region:      "Maharashtra",
			City:        "Mumbai",
			Hostname:    "in-01.protonvpn.net",
			PortForward: true,
			SecureCore:  true,
			UDP:         true,
			TCP:         true,
		},
		{
			VPN:         vpn.Wireguard,
			Country:     "United States",
			Region:      "California",
			City:        "Los Angeles",
			Hostname:    "us-ca-01.protonvpn.net",
			PortForward: false,
			Stream:      true,
			UDP:         true,
		},
	}
}

type TelegramSettingsResponse struct {
	Enabled  bool   `json:"enabled"`
	ChatID   string `json:"chat_id"`
	TokenSet bool   `json:"token_set"`
}

type TelegramSettingsUpdateRequest struct {
	Enabled  bool   `json:"enabled"`
	BotToken string `json:"bot_token"`
	ChatID   string `json:"chat_id"`
}

func (h *APIHandler) handleTelegramSettings(writer http.ResponseWriter, request *http.Request) {
	if h.telegramNotifier == nil {
		writeError(writer, http.StatusNotImplemented, "NOT_CONFIGURED", "Telegram notifier not available", false)
		return
	}

	switch request.Method {
	case http.MethodGet:
		currentSettings := h.telegramNotifier.GetSettings()
		response := TelegramSettingsResponse{
			Enabled:  currentSettings.Enabled,
			ChatID:   currentSettings.ChatID,
			TokenSet: currentSettings.BotToken != "",
		}
		writeJSON(writer, http.StatusOK, response)
	case http.MethodPost:
		var updateRequest TelegramSettingsUpdateRequest
		err := json.NewDecoder(request.Body).Decode(&updateRequest)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "INVALID_JSON", "Failed to parse JSON body", false)
			return
		}
		h.telegramNotifier.UpdateSettings(updateRequest.Enabled, updateRequest.BotToken, updateRequest.ChatID)
		currentSettings := h.telegramNotifier.GetSettings()
		response := TelegramSettingsResponse{
			Enabled:  currentSettings.Enabled,
			ChatID:   currentSettings.ChatID,
			TokenSet: currentSettings.BotToken != "",
		}
		writeJSON(writer, http.StatusOK, response)
	default:
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
	}
}

func (h *APIHandler) handleTelegramTest(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", false)
		return
	}

	if h.telegramNotifier == nil {
		writeError(writer, http.StatusNotImplemented, "NOT_CONFIGURED", "Telegram notifier not available", false)
		return
	}

	err := h.telegramNotifier.SendTest(request.Context())
	if err != nil {
		writeError(writer, http.StatusBadRequest, "TELEGRAM_TEST_FAILED", err.Error(), false)
		return
	}

	writeJSON(writer, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "Test message sent to Telegram successfully",
	})
}
