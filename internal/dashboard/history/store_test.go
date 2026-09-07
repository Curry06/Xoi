package history

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_HistoryStore(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "history.json")

	store := NewStore(filePath)

	// Add event with secret in message and metadata
	event1 := store.AddEvent(HistoryEvent{
		Type:     EventAudit,
		Severity: "info",
		Title:    "User Login",
		Message:  "User admin logged in with token Bearer secretToken123456",
		Metadata: map[string]any{
			"username": "admin",
			"password": "mysecretpassword",
		},
	})

	assert.NotEmpty(t, event1.ID)
	assert.Contains(t, event1.Message, "[REDACTED]")
	assert.Equal(t, "[REDACTED]", event1.Metadata["password"])
	assert.Equal(t, "admin", event1.Metadata["username"])

	// Add second event
	_ = store.AddEvent(HistoryEvent{
		Type:     EventIPChange,
		Severity: "warn",
		Title:    "IP Changed",
		Message:  "New public IP assigned",
	})

	// List all
	allEvents := store.ListEvents(Filter{})
	assert.Len(t, allEvents, 2)

	// Filter by type
	auditEvents := store.ListEvents(Filter{Type: EventAudit})
	assert.Len(t, auditEvents, 1)
	assert.Equal(t, EventAudit, auditEvents[0].Type)

	// Filter by severity
	warnEvents := store.ListEvents(Filter{Severity: "warn"})
	assert.Len(t, warnEvents, 1)
	assert.Equal(t, "warn", warnEvents[0].Severity)

	// Export diagnostics
	exportBytes, err := store.ExportDiagnostics()
	require.NoError(t, err)
	assert.Contains(t, string(exportBytes), "User Login")
	assert.NotContains(t, string(exportBytes), "mysecretpassword")

	// Reload from file
	reloaded := NewStore(filePath)
	assert.Len(t, reloaded.ListEvents(Filter{}), 2)
}

func Test_HistoryStore_MaxLimit(t *testing.T) {
	t.Parallel()

	store := NewStore("")

	for i := range 1050 {
		store.AddEvent(HistoryEvent{
			Type:      EventDiagnostic,
			Severity:  "info",
			Title:     "Diagnostic event",
			Message:   "Testing event limit",
			Timestamp: time.Now(),
		})
		_ = i
	}

	events := store.ListEvents(Filter{})
	assert.Len(t, events, 1000)
}
