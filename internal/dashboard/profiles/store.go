package profiles

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

type Store struct {
	mutex    sync.RWMutex
	filePath string
	profiles map[string]Profile
}

func NewStore(filePath string) (*Store, error) {
	store := &Store{
		filePath: filePath,
		profiles: make(map[string]Profile),
	}

	if filePath != "" {
		if err := store.loadFromFile(); err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("loading profiles: %w", err)
		}
	}

	// If store is empty, seed with standard safe default profiles
	if len(store.profiles) == 0 {
		store.seedDefaults()
		if filePath != "" {
			_ = store.saveToFile()
		}
	}

	return store, nil
}

func (s *Store) seedDefaults() {
	now := time.Now()
	defaults := []Profile{
		{
			ID:             "prof_switzerland_fast",
			Name:           "Switzerland Fast P2P",
			Provider:       "protonvpn",
			Country:        "Switzerland",
			City:           "Zurich",
			Protocol:       "wireguard",
			PortForwarding: true,
			BlockMalicious: true,
			BlockAds:       true,
			IsFavorite:     true,
			CreatedAt:      now,
			UpdatedAt:      now,
		},
		{
			ID:                "prof_india_secure",
			Name:              "India Fast P2P",
			Provider:          "protonvpn",
			Country:           "India",
			Protocol:          "openvpn_udp",
			PortForwarding:    true,
			BlockMalicious:    true,
			BlockSurveillance: true,
			IsFavorite:        false,
			CreatedAt:         now,
			UpdatedAt:         now,
		},
	}

	for _, profile := range defaults {
		s.profiles[profile.ID] = profile
	}
}

func (s *Store) List() []Profile {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	result := make([]Profile, 0, len(s.profiles))
	for _, profile := range s.profiles {
		result = append(result, profile)
	}

	// Sort favorites first, then by LastUsedAt (most recent first), then by Name
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsFavorite != result[j].IsFavorite {
			return result[i].IsFavorite
		}
		if result[i].LastUsedAt != nil && result[j].LastUsedAt != nil {
			return result[i].LastUsedAt.After(*result[j].LastUsedAt)
		}
		if result[i].LastUsedAt != nil {
			return true
		}
		if result[j].LastUsedAt != nil {
			return false
		}
		return result[i].Name < result[j].Name
	})

	return result
}

func (s *Store) Get(id string) (Profile, bool) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	profile, exists := s.profiles[id]
	return profile, exists
}

func (s *Store) Create(profile Profile) (Profile, error) {
	if err := profile.Validate(); err != nil {
		return Profile{}, fmt.Errorf("validating profile: %w", err)
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if profile.ID == "" {
		profile.ID = GenerateProfileID()
	}
	now := time.Now()
	profile.CreatedAt = now
	profile.UpdatedAt = now

	s.profiles[profile.ID] = profile

	if s.filePath != "" {
		if err := s.saveToFile(); err != nil {
			return Profile{}, fmt.Errorf("saving profile: %w", err)
		}
	}

	return profile, nil
}

func (s *Store) Update(id string, updated Profile) (Profile, error) {
	if err := updated.Validate(); err != nil {
		return Profile{}, fmt.Errorf("validating profile: %w", err)
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	existing, exists := s.profiles[id]
	if !exists {
		return Profile{}, ErrProfileNotFound
	}

	updated.ID = id
	updated.CreatedAt = existing.CreatedAt
	updated.UpdatedAt = time.Now()
	if updated.LastUsedAt == nil {
		updated.LastUsedAt = existing.LastUsedAt
	}

	s.profiles[id] = updated

	if s.filePath != "" {
		if err := s.saveToFile(); err != nil {
			return Profile{}, fmt.Errorf("saving profile: %w", err)
		}
	}

	return updated, nil
}

func (s *Store) Delete(id string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, exists := s.profiles[id]; !exists {
		return ErrProfileNotFound
	}

	delete(s.profiles, id)

	if s.filePath != "" {
		if err := s.saveToFile(); err != nil {
			return fmt.Errorf("saving profile after deletion: %w", err)
		}
	}

	return nil
}

func (s *Store) MarkUsed(id string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if profile, exists := s.profiles[id]; exists {
		now := time.Now()
		profile.LastUsedAt = &now
		s.profiles[id] = profile
		if s.filePath != "" {
			_ = s.saveToFile()
		}
	}
}

func (s *Store) ExportJSON() ([]byte, error) {
	profiles := s.List()
	return json.MarshalIndent(profiles, "", "  ")
}

func (s *Store) ImportJSON(data []byte) (int, error) {
	var imported []Profile
	if err := json.Unmarshal(data, &imported); err != nil {
		return 0, fmt.Errorf("parsing imported profiles json: %w", err)
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	count := 0
	now := time.Now()
	for _, profile := range imported {
		if err := profile.Validate(); err != nil {
			continue
		}
		if profile.ID == "" {
			profile.ID = GenerateProfileID()
		}
		if profile.CreatedAt.IsZero() {
			profile.CreatedAt = now
		}
		profile.UpdatedAt = now

		s.profiles[profile.ID] = profile
		count++
	}

	if s.filePath != "" && count > 0 {
		_ = s.saveToFile()
	}

	return count, nil
}

func (s *Store) loadFromFile() error {
	fileBytes, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var loaded []Profile
	if err := json.Unmarshal(fileBytes, &loaded); err != nil {
		return fmt.Errorf("unmarshaling profiles: %w", err)
	}

	s.profiles = make(map[string]Profile, len(loaded))
	for _, profile := range loaded {
		s.profiles[profile.ID] = profile
	}

	return nil
}

func (s *Store) saveToFile() error {
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return fmt.Errorf("creating directory: %w", err)
	}

	profiles := make([]Profile, 0, len(s.profiles))
	for _, profile := range s.profiles {
		profiles = append(profiles, profile)
	}

	data, err := json.MarshalIndent(profiles, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling profiles: %w", err)
	}

	tempFile := s.filePath + ".tmp"
	if err := os.WriteFile(tempFile, data, 0o600); err != nil {
		return fmt.Errorf("writing temp file: %w", err)
	}

	if err := os.Rename(tempFile, s.filePath); err != nil {
		return fmt.Errorf("renaming temp file: %w", err)
	}

	return nil
}
