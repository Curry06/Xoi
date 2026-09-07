# Gluetun Control Center: Security Architecture & Hardening Guide

Security is a primary design constraint for the Gluetun Control Center. Because Gluetun controls operating-system-level networking and firewall rules, improper exposure could lead to IP leaks, unauthorized disconnection, or credential compromise.

---

## 1. Network & Port Isolation

| Service / Port | Default Binding | Access Policy |
|---|---|---|
| **Gluetun Control Server (`:8000`)** | Private Docker Bridge Only | **NEVER** exposed to host ports or external network. Only reachable by the dashboard container. |
| **Control Center Dashboard (`:9090`)** | `127.0.0.1:9090` | Bound strictly to host loopback by default. External access should only be routed through an authenticated reverse proxy (e.g. Caddy, Nginx, Traefik) with TLS. |
| **VPN Forwarded Port (e.g. `:8080`)** | External WAN Port | Assigned dynamically by the VPN provider. Only forwarded to the intended internal application container. |

---

## 2. Docker Container Hardening

The production container (`Dockerfile.dashboard` & `docker-compose.dashboard.yml`) incorporates defense-in-depth measures:

1. **Non-Root Execution**: Runs strictly as unprivileged user `appuser` (UID/GID `1000:1000`).
2. **Capability Dropping**: Drops all Linux capabilities (`cap_drop: [ALL]`).
3. **No New Privileges**: Configured with `no-new-privileges: true` to prevent privilege escalation attacks.
4. **Read-Only Root Filesystem**: Mounted with `read_only: true`. Temporary scratch writes use a size-limited `tmpfs` (`/tmp`), and persistent state is strictly confined to `/data`.
5. **No Docker Socket**: The Docker socket (`/var/run/docker.sock`) is **never** mounted into either the Gluetun container or the Dashboard container.

---

## 3. Secret Redaction & Sanitization

Gluetun settings files may contain sensitive materials:
- WireGuard private keys (`[A-Za-z0-9+/]{43}=`)
- WireGuard pre-shared keys
- OpenVPN usernames and passwords
- API tokens and Authorization headers

### Redaction Invariants
- The dashboard never returns raw Gluetun settings to the browser.
- Before serialization, strings and maps are scanned using automated regex filters and sensitive-key dictionaries in `internal/dashboard/redaction`.
- Matched credentials are replaced with `[REDACTED]`.
- User profiles saved in the dashboard only store connection routing parameters (country, city, protocol, port-forwarding flag) and never store cryptographic secrets.

---

## 4. Authentication, Sessions & CSRF Protection

When `DASHBOARD_AUTH_REQUIRED=true` (enabled by default):

1. **Secure Session Cookies**:
   - `HttpOnly`: Prevents JavaScript access to session tokens.
   - `SameSite=Lax`: Prevents cross-site cookie injection.
   - Session duration is bounded (default 24 hours with automatic cleanup).
2. **CSRF Tokens**:
   - Every authenticated session generates a cryptographically random CSRF token (`crypto/rand`).
   - Any mutating HTTP request (`POST`, `PUT`, `DELETE`) must provide this token via the `X-CSRF-Token` header.
3. **Origin Checking**:
   - The dashboard validates the `Origin` and `Referer` headers against `DASHBOARD_ALLOWED_ORIGINS` to reject cross-origin framing or forgery.

---

## 5. Control Operation Concurrency Locking

To prevent race conditions, conflicting VPN states, and denial-of-service attempts:
- A state-machine mutex lock serializes all state-changing operations (Connect, Disconnect, Reconnect, Server Switch).
- If a state change is in progress, subsequent mutation requests immediately return `409 Conflict` (`OPERATION_IN_PROGRESS`).
- Client confirmation modals are mandatory for destructive operations (`Disconnect`, `Reconnect`).
