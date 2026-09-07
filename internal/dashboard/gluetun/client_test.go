package gluetun

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/qdm12/gluetun/internal/configuration/settings"
	"github.com/qdm12/gluetun/internal/constants"
	"github.com/qdm12/gluetun/internal/constants/providers"
	"github.com/qdm12/gluetun/internal/constants/vpn"
	"github.com/qdm12/gluetun/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_RealClient_Endpoints(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiKey := r.Header.Get("X-API-Key")
		if apiKey != "test-api-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		switch r.URL.Path {
		case "/v1/version":
			_ = json.NewEncoder(w).Encode(models.BuildInformation{
				Version: "v3.39.0",
				Commit:  "abc1234",
				Created: "2026-01-01",
			})
		case "/v1/vpn/status":
			if r.Method == http.MethodGet {
				_ = json.NewEncoder(w).Encode(statusResponse{Status: "running"})
			} else if r.Method == http.MethodPut {
				_ = json.NewEncoder(w).Encode(outcomeResponse{Outcome: "stopped"})
			}
		case "/v1/vpn/settings":
			if r.Method == http.MethodGet {
				_ = json.NewEncoder(w).Encode(settings.VPN{Type: vpn.Wireguard})
			} else if r.Method == http.MethodPut {
				_, _ = w.Write([]byte("restarted"))
			}
		case "/v1/dns/status":
			_ = json.NewEncoder(w).Encode(statusResponse{Status: "running"})
		case "/v1/updater/status":
			_ = json.NewEncoder(w).Encode(statusResponse{Status: "stopped"})
		case "/v1/publicip/ip":
			_ = json.NewEncoder(w).Encode(models.PublicIP{Country: "Switzerland"})
		case "/v1/portforward":
			_ = json.NewEncoder(w).Encode(portForwardResponse{Port: 51820, Ports: []uint16{51820}})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	client := NewRealClient(server.Client(), server.URL, "test-api-key")
	ctx := context.Background()

	t.Run("get_version", func(t *testing.T) {
		t.Parallel()
		version, err := client.GetVersion(ctx)
		require.NoError(t, err)
		assert.Equal(t, "v3.39.0", version.Version)
	})

	t.Run("vpn_status", func(t *testing.T) {
		t.Parallel()
		status, err := client.GetVPNStatus(ctx)
		require.NoError(t, err)
		assert.Equal(t, constants.Running, status)

		outcome, err := client.SetVPNStatus(ctx, constants.Stopped)
		require.NoError(t, err)
		assert.Equal(t, "stopped", outcome)
	})

	t.Run("vpn_settings", func(t *testing.T) {
		t.Parallel()
		settings, err := client.GetVPNSettings(ctx)
		require.NoError(t, err)
		assert.Equal(t, vpn.Wireguard, settings.Type)

		outcome, err := client.SetVPNSettings(ctx, settings)
		require.NoError(t, err)
		assert.Equal(t, "restarted", outcome)
	})

	t.Run("public_ip", func(t *testing.T) {
		t.Parallel()
		ip, err := client.GetPublicIP(ctx)
		require.NoError(t, err)
		assert.Equal(t, "Switzerland", ip.Country)
	})

	t.Run("port_forwarded", func(t *testing.T) {
		t.Parallel()
		port, ports, err := client.GetPortForwarded(ctx)
		require.NoError(t, err)
		assert.Equal(t, uint16(51820), port)
		assert.Equal(t, []uint16{51820}, ports)
	})
}

func Test_RealClient_Errors(t *testing.T) {
	t.Parallel()

	// Server returning 500
	errorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	}))
	defer errorServer.Close()

	client := NewRealClient(errorServer.Client(), errorServer.URL, "")
	ctx := context.Background()

	_, err := client.GetVPNStatus(ctx)
	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrUnexpectedStatus)

	// Context cancellation
	canceledCtx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = client.GetVersion(canceledCtx)
	assert.Error(t, err)
}

func Test_MockClient(t *testing.T) {
	t.Parallel()

	mock := NewMockClient(ScenarioConnected)
	assert.True(t, mock.IsMock())

	ctx := context.Background()

	// Verify connected state
	status, err := mock.GetVPNStatus(ctx)
	require.NoError(t, err)
	assert.Equal(t, constants.Running, status)

	port, _, err := mock.GetPortForwarded(ctx)
	require.NoError(t, err)
	assert.Equal(t, uint16(45823), port)

	ip, err := mock.GetPublicIP(ctx)
	require.NoError(t, err)
	assert.Equal(t, "Switzerland", ip.Country)

	// Switch scenario to disconnected
	mock.SetScenario(ScenarioDisconnected)
	status, err = mock.GetVPNStatus(ctx)
	require.NoError(t, err)
	assert.Equal(t, constants.Stopped, status)

	port, _, err = mock.GetPortForwarded(ctx)
	require.NoError(t, err)
	assert.Equal(t, uint16(0), port)

	// Switch scenario to server switch failure
	mock.SetScenario(ScenarioServerSwitchFailure)
	_, err = mock.SetVPNSettings(ctx, settings.VPN{})
	assert.Error(t, err)

	// Switch scenario to unsupported capability
	mock.SetScenario(ScenarioUnsupportedCapability)
	capabilities := mock.GetCapabilities()
	assert.False(t, capabilities.CanSwitchServerRuntime)
	assert.False(t, capabilities.CanReadPortForwarding)

	// Test SetVPNStatus
	outcome, err := mock.SetVPNStatus(ctx, constants.Running)
	require.NoError(t, err)
	assert.NotEmpty(t, outcome)
	currentStatus, _ := mock.GetVPNStatus(ctx)
	assert.Equal(t, constants.Running, currentStatus)

	// Test SetVPNSettings with country override
	mock.SetScenario(ScenarioConnected)
	outcome, err = mock.SetVPNSettings(ctx, settings.VPN{
		Provider: settings.Provider{
			Name: providers.Protonvpn,
			ServerSelection: settings.ServerSelection{
				Countries: []string{"Iceland"},
			},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "restarted", outcome)
	newIP, _ := mock.GetPublicIP(ctx)
	assert.Equal(t, "Iceland", newIP.Country)
}
