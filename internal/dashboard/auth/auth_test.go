package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_SessionStore(t *testing.T) {
	t.Parallel()

	store := NewSessionStore(100 * time.Millisecond)

	session, err := store.CreateSession("admin")
	require.NoError(t, err)
	assert.NotEmpty(t, session.Token)
	assert.NotEmpty(t, session.CSRFToken)
	assert.Equal(t, "admin", session.Username)

	// Fetch valid session
	retrieved, exists := store.GetSession(session.Token)
	assert.True(t, exists)
	assert.Equal(t, session.Token, retrieved.Token)

	// Non-existent token
	_, exists = store.GetSession("nonexistent")
	assert.False(t, exists)

	// Delete session
	store.DeleteSession(session.Token)
	_, exists = store.GetSession(session.Token)
	assert.False(t, exists)

	// Expiration
	session2, err := store.CreateSession("admin2")
	require.NoError(t, err)
	time.Sleep(120 * time.Millisecond)
	_, exists = store.GetSession(session2.Token)
	assert.False(t, exists)
}

func Test_Authenticator_Login(t *testing.T) {
	t.Parallel()

	authenticator := NewAuthenticator("admin", "secret123", true, 1*time.Hour)

	testCases := map[string]struct {
		clientIP    string
		username    string
		password    string
		expectError bool
		expectedErr error
	}{
		"valid_credentials": {
			clientIP:    "192.168.1.10",
			username:    "admin",
			password:    "secret123",
			expectError: false,
		},
		"wrong_password": {
			clientIP:    "192.168.1.11",
			username:    "admin",
			password:    "wrongpass",
			expectError: true,
			expectedErr: ErrUnauthorized,
		},
		"wrong_username": {
			clientIP:    "192.168.1.12",
			username:    "user",
			password:    "secret123",
			expectError: true,
			expectedErr: ErrUnauthorized,
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			session, err := authenticator.Login(testCase.clientIP, testCase.username, testCase.password)
			if testCase.expectError {
				assert.Error(t, err)
				if testCase.expectedErr != nil {
					assert.ErrorIs(t, err, testCase.expectedErr)
				}
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, session.Token)
			}
		})
	}
}

func Test_Authenticator_ValidateRequest(t *testing.T) {
	t.Parallel()

	authenticator := NewAuthenticator("admin", "secret123", true, 1*time.Hour)
	session, err := authenticator.Login("192.168.1.20", "admin", "secret123")
	require.NoError(t, err)

	testCases := map[string]struct {
		method      string
		token       string
		csrfHeader  string
		inCookie    bool
		expectError bool
		expectedErr error
	}{
		"valid_get_with_bearer": {
			method:      http.MethodGet,
			token:       session.Token,
			expectError: false,
		},
		"valid_get_with_cookie": {
			method:      http.MethodGet,
			token:       session.Token,
			inCookie:    true,
			expectError: false,
		},
		"missing_token": {
			method:      http.MethodGet,
			token:       "",
			expectError: true,
			expectedErr: ErrUnauthorized,
		},
		"post_with_valid_csrf": {
			method:      http.MethodPost,
			token:       session.Token,
			csrfHeader:  session.CSRFToken,
			expectError: false,
		},
		"post_with_missing_csrf": {
			method:      http.MethodPost,
			token:       session.Token,
			csrfHeader:  "",
			expectError: true,
			expectedErr: ErrInvalidCSRFToken,
		},
		"post_with_wrong_csrf": {
			method:      http.MethodPost,
			token:       session.Token,
			csrfHeader:  "invalid-csrf",
			expectError: true,
			expectedErr: ErrInvalidCSRFToken,
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			request := httptest.NewRequest(testCase.method, "/api/dashboard/status", nil)
			if testCase.inCookie {
				request.AddCookie(&http.Cookie{
					Name:  "gluetun_session",
					Value: testCase.token,
				})
			} else if testCase.token != "" {
				request.Header.Set("Authorization", "Bearer "+testCase.token)
			}

			if testCase.csrfHeader != "" {
				request.Header.Set("X-CSRF-Token", testCase.csrfHeader)
			}

			validatedSession, err := authenticator.ValidateRequest(request)
			if testCase.expectError {
				assert.Error(t, err)
				if testCase.expectedErr != nil {
					assert.ErrorIs(t, err, testCase.expectedErr)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, session.Token, validatedSession.Token)
			}
		})
	}
}

func Test_RateLimiter(t *testing.T) {
	t.Parallel()

	// 2 tokens per second, burst 2
	limiter := NewRateLimiter(2.0, 2.0)

	// First 2 requests should be allowed
	assert.True(t, limiter.Allow("client-1"))
	assert.True(t, limiter.Allow("client-1"))

	// 3rd should be rejected immediately
	assert.False(t, limiter.Allow("client-1"))

	// Different client should still be allowed
	assert.True(t, limiter.Allow("client-2"))
}
