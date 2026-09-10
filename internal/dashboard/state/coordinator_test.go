package state

import (
	"context"
	"testing"
	"time"

	"github.com/qdm12/gluetun/internal/dashboard/gluetun"
	"github.com/qdm12/gluetun/internal/dashboard/history"
	"github.com/qdm12/gluetun/internal/dashboard/profiles"
	"github.com/qdm12/gluetun/internal/proxy"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_Coordinator_SnapshotAndTransitions(t *testing.T) {
	t.Parallel()

	mockClient := gluetun.NewMockClient(gluetun.ScenarioConnected)
	historyStore := history.NewStore("")
	profileStore, err := profiles.NewStore("")
	require.NoError(t, err)

	coordinator := NewCoordinator(mockClient, historyStore, profileStore, "1.0.0", 8080)
	ctx := context.Background()

	// Initial refresh
	snapshot := coordinator.Refresh(ctx)
	assert.True(t, snapshot.EngineOnline)
	assert.Equal(t, StateConnected, snapshot.State)
	assert.Equal(t, "Switzerland", snapshot.Country)
	assert.Equal(t, uint16(45823), snapshot.PortForwarding.Port)
	assert.True(t, snapshot.PortForwarding.Available)
	assert.Equal(t, "185.156.175.42:45823", snapshot.PortForwarding.FullEndpoint)

	// Test operation locking
	unlock, ok := coordinator.TryLockOperation("reconnect")
	assert.True(t, ok)
	assert.True(t, coordinator.IsOperationInProgress())

	// Concurrent lock should fail
	_, ok2 := coordinator.TryLockOperation("another_op")
	assert.False(t, ok2)

	// Release lock
	unlock()
	assert.False(t, coordinator.IsOperationInProgress())

	// Switch mock to disconnected
	mockClient.SetScenario(gluetun.ScenarioDisconnected)
	snapshot = coordinator.Refresh(ctx)
	assert.Equal(t, StateDisconnected, snapshot.State)
	assert.False(t, snapshot.PortForwarding.Available)

	// Switch mock to connecting
	mockClient.SetScenario(gluetun.ScenarioConnecting)
	snapshot = coordinator.Refresh(ctx)
	assert.Equal(t, StateConnecting, snapshot.State)

	// Switch mock to degraded DNS
	mockClient.SetScenario(gluetun.ScenarioDegradedDNS)
	snapshot = coordinator.Refresh(ctx)
	assert.Equal(t, StateDegraded, snapshot.State)

	// Verify events were recorded
	events := historyStore.ListEvents(history.Filter{})
	assert.NotEmpty(t, events)
}

type mockProxyEndpointUpdater struct {
	endpoint proxy.PublicEndpoint
}

func (updater *mockProxyEndpointUpdater) UpdatePublicEndpoint(endpoint proxy.PublicEndpoint) {
	updater.endpoint = endpoint
}

func Test_Coordinator_ProxyEndpointState(t *testing.T) {
	t.Parallel()

	mockClient := gluetun.NewMockClient(gluetun.ScenarioConnected)
	historyStore := history.NewStore("")
	profileStore, err := profiles.NewStore("")
	require.NoError(t, err)
	coordinator := NewCoordinator(mockClient, historyStore, profileStore, "1.0.0", 8080)
	updater := &mockProxyEndpointUpdater{}
	coordinator.SetProxyUpdater(updater)

	coordinator.Refresh(context.Background())
	assert.Equal(t, "active", updater.endpoint.Status)
	assert.Equal(t, "185.156.175.42", updater.endpoint.PublicIP)
	assert.Equal(t, uint16(45823), updater.endpoint.ForwardedPort)

	mockClient.SetScenario(gluetun.ScenarioDisconnected)
	coordinator.Refresh(context.Background())
	assert.Equal(t, "vpn_offline", updater.endpoint.Status)
	assert.Zero(t, updater.endpoint.ForwardedPort)
}

func Test_Coordinator_SSE_Broadcasting(t *testing.T) {
	t.Parallel()

	mockClient := gluetun.NewMockClient(gluetun.ScenarioConnected)
	historyStore := history.NewStore("")
	profileStore, _ := profiles.NewStore("")

	coordinator := NewCoordinator(mockClient, historyStore, profileStore, "1.0.0", 8080)
	ctx := context.Background()

	ch := coordinator.Subscribe()
	t.Cleanup(func() {
		coordinator.Unsubscribe(ch)
	})

	// Initial message on subscribe
	select {
	case snapshot := <-ch:
		assert.Equal(t, "1.0.0", snapshot.DashboardVersion)
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for initial SSE snapshot")
	}

	// Trigger refresh and wait for broadcast
	coordinator.Refresh(ctx)
	select {
	case snapshot := <-ch:
		assert.Equal(t, StateConnected, snapshot.State)
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for broadcast SSE snapshot")
	}
}

type mockTelegramNotifier struct {
	enabled      bool
	updatesSent  chan string
	receivedPort chan uint16
}

func (m *mockTelegramNotifier) IsEnabled() bool {
	return m.enabled
}

func (m *mockTelegramNotifier) SendUpdate(_ context.Context, publicIP, _ string, port uint16) error {
	m.updatesSent <- publicIP
	m.receivedPort <- port
	return nil
}

func Test_Coordinator_TelegramNotification(t *testing.T) {
	t.Parallel()

	mockClient := gluetun.NewMockClient(gluetun.ScenarioConnected)
	historyStore := history.NewStore("")
	profileStore, _ := profiles.NewStore("")

	coordinator := NewCoordinator(mockClient, historyStore, profileStore, "1.0.0", 8080)
	notifier := &mockTelegramNotifier{
		enabled:      true,
		updatesSent:  make(chan string, 10),
		receivedPort: make(chan uint16, 10),
	}
	coordinator.SetTelegramNotifier(notifier)

	ctx := context.Background()
	_ = coordinator.Refresh(ctx)

	select {
	case ip := <-notifier.updatesSent:
		assert.NotEmpty(t, ip)
	case <-time.After(2 * time.Second):
		t.Fatal("expected telegram update was not sent")
	}

	select {
	case port := <-notifier.receivedPort:
		assert.Equal(t, uint16(45823), port)
	case <-time.After(2 * time.Second):
		t.Fatal("expected telegram port was not sent")
	}

	// Refresh again with no IP/port change - should NOT send duplicate
	_ = coordinator.Refresh(ctx)
	select {
	case duplicateIP := <-notifier.updatesSent:
		t.Fatalf("unexpected duplicate notification sent for IP %s", duplicateIP)
	case <-time.After(200 * time.Millisecond):
		// Success: no duplicate sent
	}
}
