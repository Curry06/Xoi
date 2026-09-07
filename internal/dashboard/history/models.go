package history

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

type EventType string

const (
	EventConnectionState EventType = "connection_state"
	EventIPChange        EventType = "ip_change"
	EventPortChange      EventType = "port_change"
	EventAudit           EventType = "audit"
	EventDiagnostic      EventType = "diagnostic"
	EventHealthCheck     EventType = "health_check"
)

type HistoryEvent struct {
	ID        string         `json:"id"`
	Timestamp time.Time      `json:"timestamp"`
	Type      EventType      `json:"type"`
	Severity  string         `json:"severity"` // info, warn, error
	Title     string         `json:"title"`
	Message   string         `json:"message"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

type Filter struct {
	Type     EventType
	Severity string
	Limit    int
}

func GenerateEventID() string {
	bytes := make([]byte, 8)
	_, _ = rand.Read(bytes)
	return fmt.Sprintf("evt_%s", hex.EncodeToString(bytes))
}
