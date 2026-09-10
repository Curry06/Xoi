# Architecture: Component Architecture

This document details the responsibilities, dependencies, interfaces, and failure modes of every major subsystem in the repository.

---

## 1. Engine Subsystems (`cmd/gluetun`)

### 1.1. VPN Lifecycle Loop (`internal/vpn/`)
- **Purpose**: Controls the creation, execution, health monitoring, and termination of encrypted VPN tunnels.
- **Key Files**:
  - [`internal/vpn/loop.go`](file:///home/vedx/Videos/Gul/internal/vpn/loop.go): State machine wrapper implementing `loopstate.State`.
  - [`internal/vpn/run.go`](file:///home/vedx/Videos/Gul/internal/vpn/run.go): Core event loop listening on `l.start`, `l.stop`, `waitError`, and `ctx.Done()`.
  - [`internal/vpn/tunnelup.go`](file:///home/vedx/Videos/Gul/internal/vpn/tunnelup.go): Executes post-tunnel tasks (firewall rules, PMTUD, DNS startup, health checker, public IP fetch, port forwarding).
  - [`internal/vpn/wireguard.go`](file:///home/vedx/Videos/Gul/internal/vpn/wireguard.go), [`openvpn.go`](file:///home/vedx/Videos/Gul/internal/vpn/openvpn.go), [`amneziawg.go`](file:///home/vedx/Videos/Gul/internal/vpn/amneziawg.go): Protocol-specific runners.
- **State**: `stopped`, `starting`, `running`, `crashed`.
- **Failure Mode**: If tunnel subprocess terminates or network interface errors out, triggers `l.crashed()`, initiates backoff, and attempts restart if configured.

### 1.2. Firewall & Kill-Switch (`internal/firewall/`)
- **Purpose**: Manipulates Linux netfilter/iptables rules to block all network traffic not routed through the encrypted tunnel or specified local subnets.
- **Key Files**:
  - [`internal/firewall/enable.go`](file:///home/vedx/Videos/Gul/internal/firewall/enable.go): Applies default DROP policies on `INPUT`, `OUTPUT`, `FORWARD` chains, allows loopback, and restores rules on shutdown.
  - [`internal/firewall/flush.go`](file:///home/vedx/Videos/Gul/internal/firewall/flush.go): Conntrack table flush preventing socket leaks.
  - [`internal/firewall/ports.go`](file:///home/vedx/Videos/Gul/internal/firewall/ports.go): Allows input ports on external/internal interfaces.
  - [`internal/firewall/redirect.go`](file:///home/vedx/Videos/Gul/internal/firewall/redirect.go): DNAT port redirect rules for port forwarding.
- **Dependencies**: Linux iptables/ip6tables binary, netlink socket.
- **Failure Mode**: If rule creation fails, returns error during engine startup and refuses to launch un-tunneled traffic.

### 1.3. Kernel Routing Engine (`internal/routing/`)
- **Purpose**: Inspects and alters Linux kernel network routes and policy routing rules.
- **Key Files**:
  - [`internal/routing/default.go`](file:///home/vedx/Videos/Gul/internal/routing/default.go): Discovers default gateway, default interface, and subnet mask.
  - [`internal/routing/rules.go`](file:///home/vedx/Videos/Gul/internal/routing/rules.go): Adds and removes ip rules (`from <subnet> lookup <table_id>`).
  - [`internal/routing/local.go`](file:///home/vedx/Videos/Gul/internal/routing/local.go): Discovers local subnets and creates bypass rules.
- **Dependencies**: `netlink` package (`rtnetlink` socket).

### 1.4. Port Forwarding Subsystem (`internal/portforward/`)
- **Purpose**: Dynamically requests port forward leases from VPN providers using NAT-PMP or provider-specific APIs, maintains renewals, and writes ports to disk.
- **Key Files**:
  - [`internal/portforward/loop.go`](file:///home/vedx/Videos/Gul/internal/portforward/loop.go): Lifecycle loop for port forwarding.
  - [`internal/portforward/service/start.go`](file:///home/vedx/Videos/Gul/internal/portforward/service/start.go): First-time port forward request, triggers firewall allowances and port file write (`/gluetun/forwarded_port`).
  - [`internal/portforward/service/fs.go`](file:///home/vedx/Videos/Gul/internal/portforward/service/fs.go): File persistence of forwarded port for downstream scripts.
- **Failure Mode**: If lease renewal fails, notifies runError channel and attempts automatic re-lease.

### 1.5. Encrypted DNS Resolver (`internal/dns/`)
- **Purpose**: Provides encrypted DNS over TLS (DoT) via Unbound or DNS over HTTPS (DoH), with ad-blocking and malicious domain filtering.
- **Key Files**:
  - [`internal/dns/loop.go`](file:///home/vedx/Videos/Gul/internal/dns/loop.go): Unbound server lifecycle and restart ticker.
  - [`internal/dns/unbound.go`](file:///home/vedx/Videos/Gul/internal/dns/unbound.go): Configuration file generation for Unbound daemon.

### 1.6. Public IP Fetcher (`internal/publicip/`)
- **Purpose**: Retrieves external IP address, country, city, region, and ISP through external IP lookup APIs over the tunnel.
- **Key Files**:
  - [`internal/publicip/loop.go`](file:///home/vedx/Videos/Gul/internal/publicip/loop.go): Periodic or on-demand fetch loop.
  - [`internal/publicip/api/`](file:///home/vedx/Videos/Gul/internal/publicip/api/): Adapters for `ipinfo.io`, `cloudflare`, `ifconfig.co`, etc.

### 1.7. Embedded Server Database (`internal/storage/`)
- **Purpose**: Loads and parses built-in database of thousands of VPN servers (ProtonVPN, Mullvad, PIA, etc.) with coordinates, IPs, capabilities, and country codes.
- **Key Files**:
  - [`internal/storage/storage.go`](file:///home/vedx/Videos/Gul/internal/storage/storage.go): Thread-safe server storage reader with `sync.RWMutex`.
  - [`internal/storage/servers.go`](file:///home/vedx/Videos/Gul/internal/storage/servers.go): Server retrieval and filtering by country, city, protocol.

### 1.8. Engine HTTP Control Server (`internal/server/`)
- **Purpose**: Internal REST API listening on port `8000` allowing administrative control over the VPN loop.
- **Key Files**:
  - [`internal/server/handler.go`](file:///home/vedx/Videos/Gul/internal/server/handler.go): Middleware chain and version router (`/v1` and legacy `/v0`).
  - [`internal/server/vpn.go`](file:///home/vedx/Videos/Gul/internal/server/vpn.go): Handles `GET/PUT /v1/vpn/status` and `GET/PUT /v1/vpn/settings`.
  - [`internal/server/publicip.go`](file:///home/vedx/Videos/Gul/internal/server/publicip.go), [`portforward.go`](file:///home/vedx/Videos/Gul/internal/server/portforward.go), [`dns.go`](file:///home/vedx/Videos/Gul/internal/server/dns.go), [`updater.go`](file:///home/vedx/Videos/Gul/internal/server/updater.go).

---

## 2. Dashboard Subsystems (`cmd/gluetun-dashboard`)

### 2.1. State Coordinator (`internal/dashboard/state/`)
- **Purpose**: Central state synchronization hub between the Gluetun engine, the frontend SSE stream, the audit log, and Telegram notifications.
- **Key Files**:
  - [`internal/dashboard/state/coordinator.go`](file:///home/vedx/Videos/Gul/internal/dashboard/state/coordinator.go): Maintains `LiveSnapshot`, runs periodic engine poll (2.5s), serializes operations via `operationMutex`, and broadcasts updates to subscribers.
  - [`internal/dashboard/state/traffic.go`](file:///home/vedx/Videos/Gul/internal/dashboard/state/traffic.go): In-memory smoothing and rolling rate series (1m, 15m, 1h).

### 2.2. Authentication & Session Manager (`internal/dashboard/auth/`)
- **Purpose**: Authenticates operator access, manages cookie/bearer sessions, enforces per-IP token bucket rate limits, and validates CSRF tokens.
- **Key Files**:
  - [`internal/dashboard/auth/auth.go`](file:///home/vedx/Videos/Gul/internal/dashboard/auth/auth.go): `Authenticator` and `RateLimiter`. Constant-time password verification via `crypto/subtle`.
  - [`internal/dashboard/auth/session.go`](file:///home/vedx/Videos/Gul/internal/dashboard/auth/session.go): In-memory thread-safe session map with cryptorand token generation.

### 2.3. Secret Redaction Filter (`internal/dashboard/redaction/`)
- **Purpose**: Sanitizes VPN settings and engine data to guarantee zero leakage of cryptographic keys, pre-shared keys, passwords, or tokens.
- **Key Files**:
  - [`internal/dashboard/redaction/redact.go`](file:///home/vedx/Videos/Gul/internal/dashboard/redaction/redact.go): Regex matching and recursive map/string scrubbing.

### 2.4. Persistent Profile & Audit Stores (`internal/dashboard/profiles/`, `history/`)
- **Purpose**: Persists operator data (saved VPN connection presets and chronological audit history) in JSON format on disk (`/data`).
- **Key Files**:
  - [`internal/dashboard/profiles/store.go`](file:///home/vedx/Videos/Gul/internal/dashboard/profiles/store.go): CRUD for non-secret connection profiles (`/data/profiles.json`).
  - [`internal/dashboard/history/store.go`](file:///home/vedx/Videos/Gul/internal/dashboard/history/store.go): Ring-buffer (1000 events) for IP changes, port updates, user actions (`/data/history.json`).

### 2.5. Telegram Notification Agent (`internal/dashboard/notify/`)
- **Purpose**: Asynchronously sends alert messages to Telegram chats when public IP or forwarded port changes.
- **Key Files**:
  - [`internal/dashboard/notify/telegram.go`](file:///home/vedx/Videos/Gul/internal/dashboard/notify/telegram.go): HTTP client sending MarkdownV2 messages to Telegram Bot API with token redaction.

### 2.6. Reverse Proxy Ingress (`internal/proxy/`)
- **Purpose**: Dynamic Caddy-based reverse proxy managing ingress routes from the VPN forwarded port to internal application containers.
- **Key Files**:
  - [`internal/proxy/manager.go`](file:///home/vedx/Videos/Gul/internal/proxy/manager.go): Route lifecycle, target health checking, metrics recording.
  - [`internal/proxy/caddy.go`](file:///home/vedx/Videos/Gul/internal/proxy/caddy.go): Translates route definitions to Caddy Admin API JSON (`/load`).

### 2.7. Embedded Static Web Server (`internal/dashboard/web/`)
- **Purpose**: Serves compiled React 19 SPA static assets directly from memory with transparent client-side SPA routing fallback.
- **Key Files**:
  - [`internal/dashboard/web/embed.go`](file:///home/vedx/Videos/Gul/internal/dashboard/web/embed.go): `//go:embed all:dist` wrapper and file server.
