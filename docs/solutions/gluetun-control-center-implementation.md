# Durable Learning: Gluetun Control Center Implementation & Architecture

## Context & Problem
Gluetun is a lightweight, kernel-level VPN client that manages network namespaces, firewall kill-switches, and tunnels. Prior to this implementation, controlling Gluetun required direct interaction with its internal HTTP control server (port `8000`), manual API requests, or container restarts.

Building a browser-accessible web application required solving several core architectural and security challenges:
1. **Security Isolation**: Port `8000` must never be exposed publicly or directly to the browser.
2. **Secret Redaction**: Gluetun settings contain WireGuard private keys, pre-shared keys, and VPN credentials that must never reach the client.
3. **Engine State Integrity**: State transitions (connecting, disconnecting, switching servers) must be serialized and locked against concurrent operations.
4. **Dynamic Port Forwarding**: Port forwarding is dynamic (e.g. ProtonVPN NAT-PMP) and port `0` must never be represented as an active port.
5. **Portability**: The dashboard must run either as a containerized stack or standalone in development mock mode.

---

## Architectural Solutions

### 1. Two-Tier Management Architecture
```text
Browser (React 19 SPA)
   │  (HTTP / SSE on 127.0.0.1:9090 with CSRF token & session auth)
   ▼
Control Center Go Backend (cmd/gluetun-dashboard)
   │  - State Coordinator & Concurrency Mutex
   │  - Automated Secret Redaction Filter
   │  - Persistent Audit Trail & Profiles (/data)
   │  (Internal HTTP on private Docker bridge 'vpn-management' only)
   ▼
Gluetun VPN Engine (:8000)
```

### 2. Real vs. Mock Adapter Pattern
In `internal/dashboard/gluetun/`:
- `interface.go` defines `Client` interface (`GetVersion`, `GetVPNStatus`, `SetVPNStatus`, `GetVPNSettings`, `SetVPNSettings`, `GetPublicIP`, `GetPortForwarded`, `GetDNSStatus`, `SetDNSStatus`, `GetUpdaterStatus`, `SetUpdaterStatus`).
- `client.go` implements `RealClient` communicating with Gluetun HTTP API.
- `mock.go` implements `MockClient` simulating 8 realistic operational scenarios:
  - `connected`, `connecting`, `disconnected`, `port_unavailable`, `ip_unavailable`, `reconnecting`, `degraded_dns`, `server_switch_error`.
- Toggled via `GLUETUN_MOCK=true`. When active, displays a visible `DEMO DATA` badge in the UI.

### 3. Frontend-Backend Asset Embedding
- Frontend is a modern React 19 + TypeScript SPA built with Vite.
- `web/vite.config.ts` configures `outDir: '../internal/dashboard/web/dist'`.
- `internal/dashboard/web/embed.go` uses `//go:embed all:dist` with an `http.FileServer` and fallback to `index.html` for client-side routing.
- This results in a single, completely self-contained Go binary with zero external asset dependencies at runtime.

### 4. Secret Sanitization & Redaction Filter
In `internal/dashboard/redaction/redact.go`:
- Automatically scans keys for known sensitive prefixes (`password`, `private_key`, `secret`, `token`, `auth`).
- Scans string values for base64 WireGuard keys (`[A-Za-z0-9+/]{43}=`).
- User connection profiles stored in `/data/profiles.json` strictly forbid passwords or private keys.

### 5. Docker Container Hardening
In `Dockerfile.dashboard` & `docker-compose.dashboard.yml`:
- Runs strictly as unprivileged user `appuser` (UID `1000:1000`).
- Drops all Linux capabilities (`cap_drop: [ALL]`).
- Enforces `read_only: true` with a temporary scratch `tmpfs` at `/tmp`.
- Docker socket (`/var/run/docker.sock`) is never mounted.
- Docker Secrets support via `_FILE` environment variable pattern in Go (`DASHBOARD_ADMIN_PASSWORD_FILE`, `GLUETUN_CONTROL_API_KEY_FILE`).

---

## Testing & Verification Patterns

### Native TypeScript Testing (Node 24)
Instead of adding heavy test runner dependencies like Jest or Vitest, frontend unit tests in `web/src/__tests__/` run directly using Node 24's native type stripping:
```bash
node --experimental-strip-types --test web/src/__tests__/*.test.ts
```
*Note*: Type-only imports must use `import type { ... } from '...'` to ensure smooth runtime type stripping.

### Go Unit Testing
```bash
go test -v -count=1 ./internal/dashboard/...
```
All packages contain dedicated table tests (`_test.go`) covering API handlers, auth session management, coordinator state transitions, Gluetun clients, and secret redaction.

---

## How to Reuse in Future Work

1. **Adding New API Endpoints**:
   - Add handler to `internal/dashboard/api/handlers.go`.
   - Register route in `internal/dashboard/api/router.go`.
   - Document in `docs/api.md`.
2. **Extending VPN Provider Support**:
   - Sourced via `internal/storage/servers.go` `Storage.GetServers(provider)`.
3. **Updating Frontend Pages**:
   - Edit components in `web/src/pages/`.
   - Re-run `npm --prefix web run build` to update embedded assets in `internal/dashboard/web/dist`.
