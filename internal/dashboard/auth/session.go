package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type Session struct {
	Token     string    `json:"token"`
	CSRFToken string    `json:"csrf_token"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type SessionStore struct {
	mutex    sync.RWMutex
	sessions map[string]Session
	duration time.Duration
}

func NewSessionStore(duration time.Duration) *SessionStore {
	return &SessionStore{
		sessions: make(map[string]Session),
		duration: duration,
	}
}

func (s *SessionStore) CreateSession(username string) (Session, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return Session{}, fmt.Errorf("generating session token: %w", err)
	}
	sessionToken := hex.EncodeToString(tokenBytes)

	csrfBytes := make([]byte, 32)
	if _, err := rand.Read(csrfBytes); err != nil {
		return Session{}, fmt.Errorf("generating csrf token: %w", err)
	}
	csrfToken := hex.EncodeToString(csrfBytes)

	now := time.Now()
	session := Session{
		Token:     sessionToken,
		CSRFToken: csrfToken,
		Username:  username,
		CreatedAt: now,
		ExpiresAt: now.Add(s.duration),
	}

	s.mutex.Lock()
	s.sessions[sessionToken] = session
	s.mutex.Unlock()

	return session, nil
}

func (s *SessionStore) GetSession(token string) (Session, bool) {
	if token == "" {
		return Session{}, false
	}

	s.mutex.RLock()
	session, exists := s.sessions[token]
	s.mutex.RUnlock()

	if !exists {
		return Session{}, false
	}

	if time.Now().After(session.ExpiresAt) {
		s.DeleteSession(token)
		return Session{}, false
	}

	return session, true
}

func (s *SessionStore) DeleteSession(token string) {
	s.mutex.Lock()
	delete(s.sessions, token)
	s.mutex.Unlock()
}

func (s *SessionStore) CleanupExpired() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	now := time.Now()
	for token, session := range s.sessions {
		if now.After(session.ExpiresAt) {
			delete(s.sessions, token)
		}
	}
}
