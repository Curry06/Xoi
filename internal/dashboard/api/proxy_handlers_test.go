package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/qdm12/gluetun/internal/dashboard/auth"
	"github.com/qdm12/gluetun/internal/dashboard/gluetun"
	"github.com/qdm12/gluetun/internal/dashboard/history"
	"github.com/qdm12/gluetun/internal/dashboard/profiles"
	"github.com/qdm12/gluetun/internal/dashboard/state"
	"github.com/qdm12/gluetun/internal/proxy"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_API_Proxy_Handlers(t *testing.T) {
	t.Parallel()

	mockClient := gluetun.NewMockClient(gluetun.ScenarioConnected)
	historyStore := history.NewStore("")
	profileStore, err := profiles.NewStore("")
	require.NoError(t, err)

	coordinator := state.NewCoordinator(mockClient, historyStore, profileStore, "1.0.0", 8080)
	authenticator := auth.NewAuthenticator("admin", "password123", false, 1*time.Hour)

	proxyStore, err := proxy.NewStore("")
	require.NoError(t, err)

	mockProvider := proxy.NewMockProvider(8080)
	proxyManager := proxy.NewManager(proxyStore, mockProvider, nil, 8080)
	coordinator.SetProxyUpdater(proxyManager)

	handler := NewAPIHandler(coordinator, authenticator, nil)
	handler.SetProxyManager(proxyManager)
	router := NewRouter(handler, []string{"*"})

	// 1. Initial GET /api/dashboard/proxy/routes (empty list)
	getReq := httptest.NewRequest(http.MethodGet, "/api/dashboard/proxy/routes", nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	assert.Equal(t, http.StatusOK, getRec.Code)

	var routes []proxy.ProxyRoute
	err = json.Unmarshal(getRec.Body.Bytes(), &routes)
	require.NoError(t, err)
	assert.Empty(t, routes)

	// 2. POST /api/dashboard/proxy/routes (Create route)
	createBody := `{
		"name": "Web App",
		"routing_type": "domain",
		"domain": "app.example.com",
		"protocol": "http",
		"target_host": "127.0.0.1",
		"target_port": 3001,
		"websocket": true,
		"tls": false
	}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/proxy/routes", bytes.NewBufferString(createBody))
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	assert.Equal(t, http.StatusCreated, createRec.Code)

	var created proxy.ProxyRoute
	err = json.Unmarshal(createRec.Body.Bytes(), &created)
	require.NoError(t, err)
	assert.NotEmpty(t, created.ID)
	assert.Equal(t, "Web App", created.Name)
	assert.Equal(t, "app.example.com", created.Domain)

	// 3. GET /api/dashboard/proxy/routes/{id}
	getOneReq := httptest.NewRequest(http.MethodGet, "/api/dashboard/proxy/routes/"+created.ID, nil)
	getOneRec := httptest.NewRecorder()
	router.ServeHTTP(getOneRec, getOneReq)
	assert.Equal(t, http.StatusOK, getOneRec.Code)

	var detailsResp map[string]any
	err = json.Unmarshal(getOneRec.Body.Bytes(), &detailsResp)
	require.NoError(t, err)
	assert.Contains(t, detailsResp, "route")
	assert.Contains(t, detailsResp, "metrics")

	// 4. POST /api/dashboard/proxy/routes/{id}/disable
	disableReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/proxy/routes/"+created.ID+"/disable", nil)
	disableRec := httptest.NewRecorder()
	router.ServeHTTP(disableRec, disableReq)
	assert.Equal(t, http.StatusOK, disableRec.Code)

	// 5. POST /api/dashboard/proxy/routes/{id}/enable
	enableReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/proxy/routes/"+created.ID+"/enable", nil)
	enableRec := httptest.NewRecorder()
	router.ServeHTTP(enableRec, enableReq)
	assert.Equal(t, http.StatusOK, enableRec.Code)

	// 6. Test Target endpoint POST /api/dashboard/proxy/routes/test-target
	testTargetBody := `{"target_host": "127.0.0.1", "target_port": 9999}`
	testTargetReq := httptest.NewRequest(http.MethodPost, "/api/dashboard/proxy/routes/test-target", bytes.NewBufferString(testTargetBody))
	testTargetRec := httptest.NewRecorder()
	router.ServeHTTP(testTargetRec, testTargetReq)
	assert.Equal(t, http.StatusOK, testTargetRec.Code)

	// 7. GET /api/dashboard/proxy/status
	statusReq := httptest.NewRequest(http.MethodGet, "/api/dashboard/proxy/status", nil)
	statusRec := httptest.NewRecorder()
	router.ServeHTTP(statusRec, statusReq)
	assert.Equal(t, http.StatusOK, statusRec.Code)

	var status proxy.ProxyStatus
	err = json.Unmarshal(statusRec.Body.Bytes(), &status)
	require.NoError(t, err)
	assert.Equal(t, 1, status.RoutesCount)

	// 8. GET /api/dashboard/public-endpoint
	endpointReq := httptest.NewRequest(http.MethodGet, "/api/dashboard/public-endpoint", nil)
	endpointRec := httptest.NewRecorder()
	router.ServeHTTP(endpointRec, endpointReq)
	assert.Equal(t, http.StatusOK, endpointRec.Code)

	// 9. DELETE /api/dashboard/proxy/routes/{id}
	delReq := httptest.NewRequest(http.MethodDelete, "/api/dashboard/proxy/routes/"+created.ID, nil)
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)
	assert.Equal(t, http.StatusOK, delRec.Code)

	// Verify route is gone
	getAfterDel := httptest.NewRequest(http.MethodGet, "/api/dashboard/proxy/routes/"+created.ID, nil)
	recAfterDel := httptest.NewRecorder()
	router.ServeHTTP(recAfterDel, getAfterDel)
	assert.Equal(t, http.StatusNotFound, recAfterDel.Code)
}

func Test_API_Proxy_MutationRequiresAuthentication(t *testing.T) {
	t.Parallel()

	mockClient := gluetun.NewMockClient(gluetun.ScenarioConnected)
	historyStore := history.NewStore("")
	profileStore, err := profiles.NewStore("")
	require.NoError(t, err)
	coordinator := state.NewCoordinator(mockClient, historyStore, profileStore, "1.0.0", 8080)
	authenticator := auth.NewAuthenticator("admin", "password123", true, time.Hour)
	handler := NewAPIHandler(coordinator, authenticator, nil)
	router := NewRouter(handler, nil)

	request := httptest.NewRequest(http.MethodPost, "/api/dashboard/proxy/routes", bytes.NewBufferString(`{}`))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}
