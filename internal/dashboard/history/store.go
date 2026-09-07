package history

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/qdm12/gluetun/internal/dashboard/redaction"
)

const maxHistoryEvents = 1000

type Store struct {
	mutex    sync.RWMutex
	filePath string
	events   []HistoryEvent
}

func NewStore(filePath string) *Store {
	store := &Store{
		filePath: filePath,
		events:   make([]HistoryEvent, 0, 100),
	}

	if filePath != "" {
		_ = store.loadFromFile()
	}

	return store
}

func (s *Store) AddEvent(event HistoryEvent) HistoryEvent {
	if event.ID == "" {
		event.ID = GenerateEventID()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	if event.Severity == "" {
		event.Severity = "info"
	}

	// Redact message and metadata
	event.Message = redaction.RedactString(event.Message)
	if event.Metadata != nil {
		event.Metadata = redaction.RedactMap(event.Metadata)
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Prepend to show newest first
	s.events = append([]HistoryEvent{event}, s.events...)
	if len(s.events) > maxHistoryEvents {
		s.events = s.events[:maxHistoryEvents]
	}

	if s.filePath != "" {
		_ = s.saveToFile()
	}

	return event
}

func (s *Store) ListEvents(filter Filter) []HistoryEvent {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	limit := filter.Limit
	if limit <= 0 || limit > maxHistoryEvents {
		limit = maxHistoryEvents
	}

	results := make([]HistoryEvent, 0, len(s.events))
	for _, event := range s.events {
		if filter.Type != "" && event.Type != filter.Type {
			continue
		}
		if filter.Severity != "" && event.Severity != filter.Severity {
			continue
		}

		results = append(results, event)
		if len(results) >= limit {
			break
		}
	}

	return results
}

func (s *Store) ExportDiagnostics() ([]byte, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return json.MarshalIndent(s.events, "", "  ")
}

func (s *Store) loadFromFile() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var loaded []HistoryEvent
	if err := json.Unmarshal(data, &loaded); err != nil {
		return err
	}

	s.events = loaded
	return nil
}

func (s *Store) saveToFile() error {
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}

	data, err := json.MarshalIndent(s.events, "", "  ")
	if err != nil {
		return err
	}

	tempFile := s.filePath + ".tmp"
	if err := os.WriteFile(tempFile, data, 0o600); err != nil {
		return err
	}

	return os.Rename(tempFile, s.filePath)
}
