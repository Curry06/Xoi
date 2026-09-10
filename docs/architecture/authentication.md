# Architecture: Authentication & Authorization

This document details the authentication, session management, CSRF protection, rate limiting, and secret protection mechanisms implemented in the system.

---

## 1. Authentication Model

The Control Center dashboard supports two operational modes controlled by `DASHBOARD_AUTH_REQUIRED`:
1. **Open / Local Dev Mode (`DASHBOARD_AUTH_REQUIRED=false`)**: Requests are treated as `anonymous` without credential challenges. Useful when deployed inside an already protected private LAN or VPN mesh.
2. **Authenticated Production Mode (`DASHBOARD_AUTH_REQUIRED=true`)**: Requires login credentials before accessing any management endpoints.

```mermaid
sequenceDiagram
    participant Browser as Web Browser
    participant Auth as Authenticator (auth/auth.go)
    participant Store as SessionStore (auth/session.go)
    participant API as Protected API Handler

    Browser->>Auth: POST /api/dashboard/auth/login {username, password}
    Note over Auth: Evaluates authRateLimiter (5 req/s)<br/>Constant-time SHA-256 comparison
    Auth->>Store: CreateSession(username)
    Store-->>Auth: Returns Session {Token, CSRFToken, ExpiresAt}
    Auth-->>Browser: Set-Cookie: gluetun_session=<Token>; HttpOnly; SameSite=Lax<br/>JSON {token, csrf_token, username}

    Browser->>API: POST /api/dashboard/vpn/connect<br/>Headers: X-CSRF-Token: <CSRFToken>, Cookie: gluetun_session=<Token>
    Note over API: AuthMiddleware validates Session & CSRFToken
    API-->>Browser: 200 OK {outcome: "success"}
```

---

## 2. Password Hashing & Verification

Implemented in [`internal/dashboard/auth/auth.go`](file:///home/vedx/Videos/Gul/internal/dashboard/auth/auth.go):
- **Timing Attack Defense**: To prevent timing side-channel attacks, password verification uses constant-time string and byte array comparisons:
  ```go
  // [VERIFIED CURRENT] internal/dashboard/auth/auth.go
  providedHash := sha256.Sum256([]byte(password))
  usernameMatches := subtle.ConstantTimeCompare([]byte(username), []byte(a.expectedUsername)) == 1
  passwordMatches := subtle.ConstantTimeCompare(providedHash[:], a.passwordHash[:]) == 1
  ```
- If credentials mismatch, `401 Unauthorized` is returned.

---

## 3. Session & CSRF Tokens

### 3.1. Cryptographic Token Generation
Session tokens and CSRF tokens are generated using Linux kernel cryptographic randomness via `crypto/rand`:
```go
// [VERIFIED CURRENT] internal/dashboard/auth/session.go
func generateRandomToken(byteLen int) (string, error) {
    b := make([]byte, byteLen)
    _, err := rand.Read(b)
    if err != nil {
        return "", err
    }
    return hex.EncodeToString(b), nil
}
```

### 3.2. CSRF Guard Invariant
- Every valid session is issued a unique `CSRFToken`.
- For any mutating request (`POST`, `PUT`, `DELETE`, `PATCH`), the middleware requires the `X-CSRF-Token` header.
- The header value is compared in constant time against `session.CSRFToken`.
- If missing or invalid, the request is aborted with `403 Forbidden: INVALID_CSRF_TOKEN`.

---

## 4. Token Bucket Rate Limiting

To prevent brute-force attacks and control-plane flooding, the system includes an in-memory token bucket rate limiter:
1. **Authentication Limiter**: Configured for 5 requests/sec with burst capacity of 10. Prevents automated credential stuffing on `/api/dashboard/auth/login`.
2. **Control Action Limiter**: Configured for 2 requests/sec with burst capacity of 5. Prevents rapid-fire reconnect/disconnect loops from thrashing kernel networking.
3. **Automatic Cleanup**: Stale client buckets are pruned every 10 minutes.

---

## 5. Secret Redaction Invariant

The dashboard acts as an isolation barrier between the user and engine secrets:
- `internal/dashboard/redaction/redact.go` inspects all JSON payloads.
- Keys matching `(?i)(key|pass|secret|token|auth|credential|wireguard.*key|preshared)` are scrubbed and replaced with `[REDACTED]`.
- 44-character base64 strings matching WireGuard keys are masked automatically.
- Telegram Bot Tokens are masked on retrieval (`token_set: true`).
