package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/qdm12/gluetun/internal/dashboard/auth"
	"github.com/qdm12/gluetun/internal/dashboard/gluetun"
	"github.com/qdm12/gluetun/internal/dashboard/history"
	"github.com/qdm12/gluetun/internal/dashboard/notify"
	"github.com/qdm12/gluetun/internal/dashboard/profiles"
	"github.com/qdm12/gluetun/internal/dashboard/state"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestAPI(t *testing.T, authRequired bool) (http.Handler, *state.Coordinator, *auth.Authenticator, *auth.Session) {
	t.Helper()

	mockClient := gluetun.NewMockClient(gluetun.ScenarioConnected)
	historyStore := history.NewStore("")
	profileStore, err := profiles.NewStore("")
	require.NoError(t, err)

	coordinator := state.NewCoordinator(mockClient, historyStore, profileStore, "1.0.0", 8080)
	coordinator.Refresh(context.Background())

	authenticator := auth.NewAuthenticator("admin", "password123", authRequired, 1*time.Hour)
	var session *auth.Session
	if authRequired {
		sess, err := authenticator.Login("127.0.0.1", "admin", "password123")
		require.NoError(t, err)
		session = &sess
	}

	handler := NewAPIHandler(coordinator, authenticator, nil)
	router := NewRouter(handler, []string{"*"})

	return router, coordinator, authenticator, session
}

func Test_API_Bootstrap_And_Status(t *testing.T) {
	t.Parallel()

	router, _, _, _ := setupTestAPI(t, false)

	// Bootstrap
	bootstrapReq := httptest.NewRequest(http.MethodGet, "/api/dashboard/bootstrap", nil)
	bootstrapRec := httptest.NewRecorder()
	router.ServeHTTP(bootstrapRec, bootstrapReq)
	assert.Equal(t, http.StatusOK, bootstrapRec.Code)

	var bootstrapData map[string]any
	err := json.Unmarshal(bootstrapRec.Body.Bytes(), &bootstrapData)
	require.NoError(t, err)
	assert.True(t, bootstrapData["is_mock"].(bool))
	assert.NotEmpty(t, bootstrapData["snapshot"])

	// Status
	statusReq := httptest.NewRequest(http.MethodGet, "/api/dashboard/status", nil)
	statusRec := httptest.NewRecorder()
	router.ServeHTTP(statusRec, statusReq)
	assert.Equal(t, http.StatusOK, statusRec.Code)

	var snapshot state.LiveSnapshot
	err = json.Unmarshal(statusRec.Body.Bytes(), &snapshot)
	require.NoError(t, err)
	assert.Equal(t, state.StateConnected, snapshot.State)
	assert.Equal(t, "Switzerland", snapshot.Country)
	assert.Equal(t, uint16(45823), snapshot.PortForwarding.Port)
}

func Test_API_Servers_Filtering(t *testing.T) {
	t.Parallel()

	router, _, _, _ := setupTestAPI(t, false)

	// List all mock servers
	req := httptest.NewRequest(http.MethodGet, "/api/dashboard/servers", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	var servers []ServerResponse
	err := json.Unmarshal(rec.Body.Bytes(), &servers)
	require.NoError(t, err)
	assert.NotEmpty(t, servers)

	// Filter by country
	reqCH := httptest.NewRequest(http.MethodGet, "/api/dashboard/servers?country=switzerland", nil)
	recCH := httptest.NewRecorder()
	router.ServeHTTP(recCH, reqCH)
	assert.Equal(t, http.StatusOK, recCH.Code)

	var chServers []ServerResponse
	err = json.Unmarshal(recCH.Body.Bytes(), &chServers)
	require.NoError(t, err)
	assert.Len(t, chServers, 1)
	assert.Equal(t, "Switzerland", chServers[0].Country)
}

func Test_API_VPN_Control_Operations(t *testing.T) {
	t.Parallel()

	router, coordinator, _, _ := setupTestAPI(t, false)

	// 1. Connect
	connectReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/vpn/connect", nil)
	connectRec := httptest.NewRecorder()
	router.ServeHTTP(connectRec, connectReq)
	assert.Equal(t, http.StatusOK, connectRec.Code)

	// 2. Disconnect without confirmation (should fail)
	discWithoutConfirm := httptest.NewRequest(http.MethodPost, "/api/dashboard/vpn/disconnect", bytes.NewReader([]byte(`{"confirmed": false}`)))
	discWithoutConfirmRec := httptest.NewRecorder()
	router.ServeHTTP(discWithoutConfirmRec, discWithoutConfirm)
	assert.Equal(t, http.StatusBadRequest, discWithoutConfirmRec.Code)

	var errEnvelope ErrorEnvelope
	err := json.Unmarshal(discWithoutConfirmRec.Body.Bytes(), &errEnvelope)
	require.NoError(t, err)
	assert.Equal(t, "CONFIRMATION_REQUIRED", errEnvelope.Error.Code)

	// 3. Disconnect with confirmation
	discWithConfirm := httptest.NewRequest(http.MethodPost, "/api/dashboard/vpn/disconnect", bytes.NewReader([]byte(`{"confirmed": true}`)))
	discWithConfirmRec := httptest.NewRecorder()
	router.ServeHTTP(discWithConfirmRec, discWithConfirm)
	assert.Equal(t, http.StatusOK, discWithConfirmRec.Code)

	// Verify status is stopped
	assert.Equal(t, state.StateDisconnected, coordinator.GetSnapshot().State)

	// 4. Reconnect with confirmation
	recReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/vpn/reconnect", bytes.NewReader([]byte(`{"confirmed": true}`)))
	recRec := httptest.NewRecorder()
	router.ServeHTTP(recRec, recReq)
	assert.Equal(t, http.StatusOK, recRec.Code)
	assert.Equal(t, state.StateConnected, coordinator.GetSnapshot().State)

	// 5. Server selection change
	selBody := `{"confirmed": true, "provider": "protonvpn", "country": "Iceland"}`
	selReq := httptest.NewRequest(http.MethodPut, "/api/dashboard/vpn/selection", bytes.NewReader([]byte(selBody)))
	selRec := httptest.NewRecorder()
	router.ServeHTTP(selRec, selReq)
	assert.Equal(t, http.StatusOK, selRec.Code)
	assert.Equal(t, "Iceland", coordinator.GetSnapshot().Country)
}

func Test_API_Endpoint_Test(t *testing.T) {
	t.Parallel()

	router, _, _, _ := setupTestAPI(t, false)

	req := httptest.NewRequest(http.MethodPost, "/api/dashboard/endpoint/test", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	var result map[string]any
	err := json.Unmarshal(rec.Body.Bytes(), &result)
	require.NoError(t, err)
	assert.True(t, result["reachable"].(bool))
	assert.NotEmpty(t, result["endpoint"])
}

func Test_API_Profiles_CRUD(t *testing.T) {
	t.Parallel()

	router, _, _, _ := setupTestAPI(t, false)

	// 1. List
	listReq := httptest.NewRequest(http.MethodGet, "/api/dashboard/profiles", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	assert.Equal(t, http.StatusOK, listRec.Code)

	// 2. Create
	newProfile := `{"name": "Singapore Gaming", "provider": "protonvpn", "country": "Singapore", "protocol": "wireguard", "port_forwarding": true}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/profiles", bytes.NewReader([]byte(newProfile)))
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	assert.Equal(t, http.StatusCreated, createRec.Code)

	var created profiles.Profile
	err := json.Unmarshal(createRec.Body.Bytes(), &created)
	require.NoError(t, err)
	assert.NotEmpty(t, created.ID)

	// 3. Apply profile
	applyReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/profiles/"+created.ID+"/apply", nil)
	applyRec := httptest.NewRecorder()
	router.ServeHTTP(applyRec, applyReq)
	assert.Equal(t, http.StatusOK, applyRec.Code)

	// 4. Delete profile
	delReq := httptest.NewRequest(http.MethodDelete, "/api/dashboard/profiles/"+created.ID, nil)
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)
	assert.Equal(t, http.StatusOK, delRec.Code)
}

func Test_API_Auth_And_CSRF_Enforcement(t *testing.T) {
	t.Parallel()

	router, _, _, session := setupTestAPI(t, true)

	// State-changing request without auth should be 401
	unauthReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/vpn/connect", nil)
	unauthRec := httptest.NewRecorder()
	router.ServeHTTP(unauthRec, unauthReq)
	assert.Equal(t, http.StatusUnauthorized, unauthRec.Code)

	// Request with auth but missing CSRF should be 403
	noCSRFReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/vpn/connect", nil)
	noCSRFReq.Header.Set("Authorization", "Bearer "+session.Token)
	noCSRFRec := httptest.NewRecorder()
	router.ServeHTTP(noCSRFRec, noCSRFReq)
	assert.Equal(t, http.StatusForbidden, noCSRFRec.Code)

	// Request with auth AND valid CSRF should succeed
	validReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/vpn/connect", nil)
	validReq.Header.Set("Authorization", "Bearer "+session.Token)
	validReq.Header.Set("X-CSRF-Token", session.CSRFToken)
	validRec := httptest.NewRecorder()
	router.ServeHTTP(validRec, validReq)
	assert.Equal(t, http.StatusOK, validRec.Code)
}

func Test_API_Telegram_Settings_And_Test(t *testing.T) {
	t.Parallel()

	mockClient := gluetun.NewMockClient(gluetun.ScenarioConnected)
	historyStore := history.NewStore("")
	profileStore, err := profiles.NewStore("")
	require.NoError(t, err)

	coordinator := state.NewCoordinator(mockClient, historyStore, profileStore, "1.0.0", 8080)
	authenticator := auth.NewAuthenticator("admin", "password123", false, 1*time.Hour)

	mockTelegramServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok": true, "result": {"message_id": 10}}`))
	}))
	defer mockTelegramServer.Close()

	notifier := notify.NewTelegramNotifier(mockTelegramServer.Client(), "", "", false)
	notifier.SetAPIBaseURLForTesting(mockTelegramServer.URL)

	handler := NewAPIHandler(coordinator, authenticator, nil)
	handler.SetTelegramNotifier(notifier)
	router := NewRouter(handler, []string{"*"})

	// 1. GET initial settings
	getReq := httptest.NewRequest(http.MethodGet, "/api/dashboard/settings/telegram", nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	assert.Equal(t, http.StatusOK, getRec.Code)

	var initialSettings TelegramSettingsResponse
	err = json.Unmarshal(getRec.Body.Bytes(), &initialSettings)
	require.NoError(t, err)
	assert.False(t, initialSettings.Enabled)
	assert.False(t, initialSettings.TokenSet)

	// 2. Update settings
	updateBody := `{"enabled": true, "bot_token": "123:MY_TOKEN", "chat_id": "-100123456"}`
	updateReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/settings/telegram", bytes.NewBufferString(updateBody))
	updateRec := httptest.NewRecorder()
	router.ServeHTTP(updateRec, updateReq)
	assert.Equal(t, http.StatusOK, updateRec.Code)

	var updatedSettings TelegramSettingsResponse
	err = json.Unmarshal(updateRec.Body.Bytes(), &updatedSettings)
	require.NoError(t, err)
	assert.True(t, updatedSettings.Enabled)
	assert.True(t, updatedSettings.TokenSet)
	assert.Equal(t, "-100123456", updatedSettings.ChatID)

	// 3. Test sending notification
	testReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/settings/telegram/test", nil)
	testRec := httptest.NewRecorder()
	router.ServeHTTP(testRec, testReq)
	assert.Equal(t, http.StatusOK, testRec.Code)

	var testResponse map[string]string
	err = json.Unmarshal(testRec.Body.Bytes(), &testResponse)
	require.NoError(t, err)
	assert.Equal(t, "success", testResponse["status"])
}

