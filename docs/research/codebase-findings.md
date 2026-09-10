# Research Log: Codebase Findings & Discoveries

This document records the empirical discoveries made during the technical deep-dive into the repository. Every finding is classified according to confidence level:
- `[VERIFIED]`: Directly confirmed from source code in this checkout.
- `[HIGH CONFIDENCE]`: Strongly supported by multiple code paths and cross-references.
- `[INFERRED]`: Plausible deduction based on architecture patterns but not 100% verified.
- `[UNKNOWN]`: Unresolved or unverified by current codebase artifacts.

---

## Finding 001: Dual-Binary System Architecture

- **Component**: Application Entry Points (`cmd/gluetun` vs `cmd/gluetun-dashboard`)
- **Observed**: The repository does not compile a single monolithic daemon. Instead, it contains two distinct, independent executable entry points:
  1. `cmd/gluetun/main.go`: The core Gluetun VPN client engine daemon (requires `CAP_NET_ADMIN`, creates tun interfaces, modifies iptables and kernel routing, manages VPN tunnels, runs on port 8000).
  2. `cmd/gluetun-dashboard/main.go`: The unprivileged Gluetun Control Center web management daemon (runs as UID 1000, serves embedded React 19 SPA, coordinates state, enforces authentication and CSRF, proxies safe controls to the engine over port 8000, runs on port 9090).
- **Evidence**:
  - `cmd/gluetun/main.go:69-143` (`main()` initializing netlink, iptables, routing, storage, vpn loop)
  - `cmd/gluetun-dashboard/main.go:36-92` (`main()` initializing stores, coordinator, auth, HTTP server)
  - `Dockerfile` (builds `entrypoint` from `cmd/gluetun/main.go`)
  - `Dockerfile.dashboard` (builds `/bin/gluetun-dashboard` from `cmd/gluetun-dashboard/main.go`)
  - `docker-compose.dashboard.yml:5-46, 50-86` (defines two separate containers: `gluetun` and `dashboard`)
- **Implication**: The system maintains a strict privilege separation boundary. The web UI and client-facing API never run in the privileged networking container.
- **Confidence**: `[VERIFIED]`

---

## Finding 002: Kernel-Level Kill-Switch Invariant

- **Component**: Firewall Engine (`internal/firewall/enable.go`, `internal/firewall/iptables/`)
- **Observed**: The kill-switch is not a polling software check or an application-layer loop. It is an immutable kernel iptables/nftables policy set immediately at startup:
  1. Default policy on `INPUT`, `OUTPUT`, and `FORWARD` chains in filter table is set to `DROP` for both IPv4 and IPv6.
  2. Loopback interface `lo` is explicitly allowed.
  3. Existing conntrack connections are flushed via netlink (`FlushConntrack()`) to prevent socket leaks that pre-dated firewall initialization.
  4. Only traffic to the specific VPN server IP, local subnet rules, and the active tunnel interface (`tun0` / `wg0`) are allowed.
  5. When the VPN disconnects or crashes, the default `DROP` policy remains active, guaranteeing zero packet leakage to WAN.
- **Evidence**:
  - `internal/firewall/enable.go:54-84`
  - `internal/firewall/flush.go:16-52`
  - `internal/vpn/run.go:96-125`
- **Implication**: Even if the dashboard stops or the VPN daemon is interrupted, the host or container network namespace cannot leak plaintext packets to the internet unless the firewall rules are explicitly torn down or bypassed via Docker host routing.
- **Confidence**: `[VERIFIED]`

---

## Finding 003: Reverse Proxy (Caddy) Layer & Current Wiring State

- **Component**: Dynamic Ingress Router (`internal/proxy/`, `internal/dashboard/api/proxy_handlers.go`, `cmd/gluetun-dashboard/main.go`)
- **Observed**:
  - A complete Caddy-backed reverse proxy management system exists in `internal/proxy/`, with route validation, SQLite/JSON persistence, health probing, and metrics registry.
  - The API router in `internal/dashboard/api/router.go` and `internal/dashboard/api/proxy_handlers.go` declares REST endpoints for `/api/dashboard/proxy/routes`, `/status`, `/metrics`, and `/public-endpoint`.
  - However, in `cmd/gluetun-dashboard/main.go`, `apiHandler.SetProxyManager(...)` is currently commented out or uncalled.
  - As a consequence, invoking `/api/dashboard/proxy/routes` in production returns `503 Service Unavailable: Reverse proxy manager is not initialized`.
- **Evidence**:
  - `internal/proxy/caddy.go:1-239` (Caddy admin API integration)
  - `internal/proxy/manager.go:28-54` (`NewManager()`)
  - `internal/dashboard/api/proxy_handlers.go:31-34` (`if h.proxyManager == nil { writeError(..., 503, ...)}`)
  - `cmd/gluetun-dashboard/main.go:176-178` (`apiHandler` initialized without `SetProxyManager`)
- **Implication**: The reverse proxy subsystem is code-complete and unit-tested in isolation, but is not yet activated in the dashboard daemon startup wiring.
- **Confidence**: `[VERIFIED]`

---

## Finding 004: Port Forwarding Dynamic Lifecycle & Sanitization

- **Component**: Port Forwarding Loop (`internal/portforward/`, `internal/natpmp/`, `internal/dashboard/state/coordinator.go`)
- **Observed**:
  - Port forwarding is dynamically acquired from supported VPN providers (such as ProtonVPN and PIA) via NAT-PMP or provider API.
  - The engine periodically refreshes the lease in a background loop (`KeepPortForward`).
  - When port forwarding is inactive or unassigned, the engine reports port `0`.
  - The dashboard state coordinator explicitly sanitizes this: port `0` is never treated as a valid active port and will never be presented to the user as an accessible endpoint.
  - When a non-zero port is allocated, the coordinator logs the allocation to `/data/history.json`, triggers an asynchronous Telegram notification (if enabled), and pushes the full public endpoint (`<public_ip>:<port>`) to connected web clients via SSE.
- **Evidence**:
  - `internal/portforward/service/start.go:13-89`
  - `internal/dashboard/state/coordinator.go:225-247, 305-330, 332-350`
  - `web/src/pages/OverviewPage.tsx:47-65`
- **Implication**: Clients can safely rely on the dashboard API's `port_forwarding.available` boolean and `port > 0` validation to determine whether external ingress is functional.
- **Confidence**: `[VERIFIED]`

---

## Finding 005: Telegram Notification Integration Flow

- **Component**: Notification Subsystem (`internal/dashboard/notify/telegram.go`, `feat/telegram-vpn-notifications` branch)
- **Observed**:
  - The dashboard backend includes an asynchronous, rate-safe Telegram Bot notifier.
  - Configuration is supplied via environment variables (`TELEGRAM_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) or through the dashboard Settings UI (`POST /api/dashboard/settings/telegram`).
  - Outbound notifications are debounced using `lastNotifiedIP` and `lastNotifiedPort` in the state coordinator to avoid spamming the user when polling the engine.
  - Notifications are dispatched in detached goroutines with strict 10-second context timeouts so that network issues reaching the Telegram API cannot stall state polling.
  - The Bot Token is automatically redacted (`token_set: true`, never echoing the raw token) when queried from the API.
- **Evidence**:
  - `internal/dashboard/notify/telegram.go:83-146`
  - `internal/dashboard/state/coordinator.go:332-350`
  - `internal/dashboard/api/handlers.go:958-1014`
- **Implication**: Real-time IP changes and port reallocations are immediately reported to operators on their mobile devices without opening external ingress ports.
- **Confidence**: `[VERIFIED]`

---

## Finding 006: In-Memory Secret Redaction Invariant

- **Component**: Redaction Engine (`internal/dashboard/redaction/redact.go`)
- **Observed**:
  - Gluetun's engine settings (`GET /v1/vpn/settings`) contain raw WireGuard private keys, pre-shared keys, OpenVPN passwords, and provider tokens.
  - The dashboard backend acts as an airlock: it calls the engine, receives the settings struct, and passes all strings and JSON representations through `RedactString()` and `RedactMap()`.
  - Sensitive keys matching `(?i)(key|pass|secret|token|auth|credential|wireguard.*key|preshared)` are replaced with `[REDACTED]`.
  - Base64 WireGuard key patterns (`[A-Za-z0-9+/]{42,43}={1,2}`) and `Bearer <token>` headers are masked regardless of what key they appear under.
- **Evidence**:
  - `internal/dashboard/redaction/redact.go:8-77`
  - `internal/dashboard/redaction/redact_test.go:1-85`
- **Implication**: Even if an admin user exports diagnostic dumps or inspects network payloads in browser DevTools, cryptographic secrets and provider credentials are never disclosed.
- **Confidence**: `[VERIFIED]`

---

## Finding 007: Container Network Sharing Model (`network_mode: "service:gluetun"`)

- **Component**: Docker Architecture (`docker-compose.dashboard.yml`)
- **Observed**:
  - Downstream application containers (such as torrent clients, media servers, or scrapers) do not create their own VPN interfaces.
  - Instead, they share Gluetun's network namespace using `network_mode: "service:gluetun"`.
  - Containers in this mode have no network interface of their own other than Gluetun's loopback and `tun0`.
  - Inbound port mapping must be declared on the `gluetun` service container in Docker Compose, not on the routed application container.
- **Evidence**:
  - `docker-compose.dashboard.yml:34-36, 90-98`
- **Implication**: If the Gluetun container stops or crashes, all routed applications immediately lose internet access (fail-closed by Linux network namespace semantics).
- **Confidence**: `[VERIFIED]`

---

## Finding 008: Embedded Static Asset Delivery with SPA Client Fallback

- **Component**: Web Distribution (`internal/dashboard/web/embed.go`)
- **Observed**:
  - The React 19 production build is embedded directly into the Go dashboard binary using `//go:embed all:dist`.
  - An HTTP handler wraps `http.FS(subFS)` and provides transparent fallback to `index.html` for any route that is not an asset and does not begin with `/api/`.
  - This allows React Router client-side routes (`/overview`, `/servers`, `/settings`, `/profiles`, `/activity`) to work seamlessly on deep links and browser refreshes without returning 404 errors.
- **Evidence**:
  - `internal/dashboard/web/embed.go:12-73`
- **Implication**: The dashboard binary is completely standalone. It requires zero external HTML/CSS/JS file dependencies at runtime.
- **Confidence**: `[VERIFIED]`
