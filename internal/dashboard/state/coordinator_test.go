package state

import (
	"context"
	"testing"
	"time"

	"github.com/qdm12/gluetun/internal/dashboard/gluetun"
	"github.com/qdm12/gluetun/internal/dashboard/history"
	"github.com/qdm12/gluetun/internal/dashboard/profiles"
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
