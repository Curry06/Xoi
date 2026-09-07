package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	ErrUnauthorized     = errors.New("unauthorized")
	ErrInvalidCSRFToken = errors.New("invalid or missing CSRF token")
	ErrRateLimited      = errors.New("rate limit exceeded, please slow down")
)

type RateLimiter struct {
	mutex       sync.Mutex
	buckets     map[string]*tokenBucket
	rate        float64
	capacity    float64
	lastCleanup time.Time
}

type tokenBucket struct {
	tokens     float64
	lastUpdate time.Time
}

func NewRateLimiter(requestsPerSecond float64, burstCapacity float64) *RateLimiter {
	return &RateLimiter{
		buckets:     make(map[string]*tokenBucket),
		rate:        requestsPerSecond,
		capacity:    burstCapacity,
		lastCleanup: time.Now(),
	}
}

func (rl *RateLimiter) Allow(clientKey string) bool {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now()
	if now.Sub(rl.lastCleanup) > 10*time.Minute {
		for key, bucket := range rl.buckets {
			if now.Sub(bucket.lastUpdate) > 10*time.Minute {
				delete(rl.buckets, key)
			}
		}
		rl.lastCleanup = now
	}

	bucket, exists := rl.buckets[clientKey]
	if !exists {
		bucket = &tokenBucket{
			tokens:     rl.capacity - 1,
			lastUpdate: now,
		}
		rl.buckets[clientKey] = bucket
		return true
	}

	elapsed := now.Sub(bucket.lastUpdate).Seconds()
	bucket.lastUpdate = now
	bucket.tokens = min(rl.capacity, bucket.tokens+elapsed*rl.rate)

	if bucket.tokens >= 1.0 {
		bucket.tokens -= 1.0
		return true
	}

	return false
}

type Authenticator struct {
	expectedUsername   string
	passwordHash       [32]byte
	sessions           *SessionStore
	authRateLimiter    *RateLimiter
	controlRateLimiter *RateLimiter
	authRequired       bool
}

func NewAuthenticator(username, password string, authRequired bool, sessionDuration time.Duration) *Authenticator {
	hash := sha256.Sum256([]byte(password))
	return &Authenticator{
		expectedUsername:   username,
		passwordHash:       hash,
		sessions:           NewSessionStore(sessionDuration),
		authRateLimiter:    NewRateLimiter(5.0, 10.0), // 5 req/s, burst 10
		controlRateLimiter: NewRateLimiter(2.0, 5.0),  // 2 req/s, burst 5 for control actions
		authRequired:       authRequired,
	}
}

func (a *Authenticator) IsAuthRequired() bool {
	return a.authRequired
}

func (a *Authenticator) AllowControlAction(clientIP string) bool {
	return a.controlRateLimiter.Allow(clientIP)
}

func (a *Authenticator) Login(clientIP, username, password string) (Session, error) {
	if !a.authRateLimiter.Allow(clientIP) {
		return Session{}, ErrRateLimited
	}

	providedHash := sha256.Sum256([]byte(password))
	usernameMatches := subtle.ConstantTimeCompare([]byte(username), []byte(a.expectedUsername)) == 1
	passwordMatches := subtle.ConstantTimeCompare(providedHash[:], a.passwordHash[:]) == 1

	if !usernameMatches || !passwordMatches {
		return Session{}, ErrUnauthorized
	}

	session, err := a.sessions.CreateSession(username)
	if err != nil {
		return Session{}, fmt.Errorf("creating session: %w", err)
	}

	return session, nil
}

func (a *Authenticator) ValidateRequest(request *http.Request) (Session, error) {
	if !a.authRequired {
		return Session{Username: "anonymous"}, nil
	}

	token := extractToken(request)
	if token == "" {
		return Session{}, ErrUnauthorized
	}

	session, ok := a.sessions.GetSession(token)
	if !ok {
		return Session{}, ErrUnauthorized
	}

	// For state-changing HTTP methods, check CSRF token
	switch request.Method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		csrfHeader := request.Header.Get("X-CSRF-Token")
		if csrfHeader == "" || subtle.ConstantTimeCompare([]byte(csrfHeader), []byte(session.CSRFToken)) != 1 {
			return Session{}, ErrInvalidCSRFToken
		}
	}

	return session, nil
}

func (a *Authenticator) Logout(request *http.Request) {
	token := extractToken(request)
	if token != "" {
		a.sessions.DeleteSession(token)
	}
}

func extractToken(request *http.Request) string {
	// Check Authorization: Bearer <token>
	authHeader := request.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}

	// Check session cookie
	cookie, err := request.Cookie("gluetun_session")
	if err == nil && cookie.Value != "" {
		return cookie.Value
	}

	return ""
}

// ExtractClientIP extracts the host part of remote address.
func ExtractClientIP(request *http.Request) string {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		return request.RemoteAddr
	}
	return host
}
