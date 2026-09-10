# Gluetun Control Center: Current Architecture Baseline

This document establishes the verified technical baseline of the repository as of `master` (commit `ef2e9117`). All technical claims are classified according to the audit rubric:
- `[VERIFIED CURRENT]`: Confirmed directly by source code in this workspace.
- `[DOCUMENTED CURRENT]`: Described in documentation and verified in code.
- `[INFERRED]`: Deduceable from architectural wiring and configuration.
- `[PLANNED]`: Proposed architecture not yet implemented in production code.
- `[MISSING]`: Expected feature absent from the current codebase.

---

## 1. System Topology & Process Boundaries

The repository contains two distinct server-side subsystems:
1. **The Gluetun Engine** (`cmd/gluetun/main.go`) — Kernel-level VPN daemon, firewall manager, routing engine, and DNS resolver.
2. **The Gluetun Control Center** (`cmd/gluetun-dashboard/main.go`) — Product-layer management daemon, REST API, state coordinator, and embedded React SPA.

```text
[VERIFIED CURRENT]
+-----------------------------------------------------------------------------------------+
| HOST / SERVER NETWORK                                                                   |
|                                                                                         |
|  [Browser Client]                                                                       |
|         │                                                                               |
|         │ HTTP / SSE (127.0.0.1:9090)                                                   |
|         ▼                                                                               |
|  +-----------------------------------------------------------------------------------+  |
|  | Gluetun Control Center (cmd/gluetun-dashboard)                                    |  |
|  |                                                                                   |  |
|  |  [Embedded React 19 SPA] ── go:embed ──► [HTTP Handler (web/embed.go)]            |  |
|  |                                                                                   |  |
|  |  [API Router (api/router.go)]                                                     |  |
|  |         ├── [Auth & CSRF Middleware (auth/auth.go)]                               |  |
|  |         └── [REST Handlers (api/handlers.go)]                                     |  |
|  |                   │                                                               |  |
|  |                   ├──► [State Coordinator (state/coordinator.go)]                 |  |
|  |                   │           ├── Mutex Lock (atomic operations)                  |  |
|  |                   │           ├── SSE Broadcaster (real-time stream)              |  |
|  |                   │           └── Telemetry / Poller                              |  |
|  |                   ├──► [Profile Store (profiles/store.go)] ──► /data/profiles.json|  |
|  |                   ├──► [History Store (history/store.go)]  ──► /data/history.json |  |
|  |                   ├──► [Storage Adapter (storage/servers.go)]                     |  |
|  |                   └──► [Engine Client Adapter (gluetun/client.go)]                |  |
|  +---------------------------------------------│-------------------------------------+  |
|                                                │                                        |
|  [Private Docker Bridge: 'vpn-management']     │ HTTP (http://gluetun:8000)             |
|                                                ▼                                        |
|  +-----------------------------------------------------------------------------------+  |
|  | Gluetun VPN Engine (cmd/gluetun)                                                  |  |
|  |                                                                                   |  |
|  |  [HTTP Control Server (server/handler.go)] (:8000)                                |  |
|  |         ├── /v1/version                                                           |  |
|  |         ├── /v1/vpn/status & /v1/vpn/settings                                     |  |
|  |         ├── /v1/publicip/ip                                                       |  |
|  |         ├── /v1/portforward                                                       |  |
|  |         ├── /v1/dns/status                                                        |  |
|  |         └── /v1/updater/status                                                    |  |
|  |                                                                                   |  |
|  |  [VPN Loop (vpn/loop.go)] ──► [WireGuard / OpenVPN / AmneziaWG Run Loop]          |  |
|  |         ├── [TUN Configurator (tun/)]                                             |  |
|  |         ├── [Routing Configurator (routing/)]                                     |  |
|  |         ├── [Firewall Kill-Switch (firewall/)]                                    |  |
|  |         ├── [DNS Loop (dns/)] ──► Unbound DoT Resolver                            |  |
|  |         ├── [Port Forward Loop (portforward/)] ──► NAT-PMP Service                |  |
|  |         └── [Public IP Loop (publicip/)] ──► Fetcher                              |  |
|  +-----------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Component Responsibility Matrix

| Subsystem / Layer | Component | Verified Path | Responsibilities | Classification |
|---|---|---|---|---|
| **Engine** | Entrypoint & Wiring | `cmd/gluetun/main.go` | Environment reading, service shutdown groups, signal handling. | `[VERIFIED CURRENT]` |
| **Engine** | Control Server | `internal/server/` | Serves internal REST API on port `8000`. | `[VERIFIED CURRENT]` |
| **Engine** | VPN Loop & Runners | `internal/vpn/` | Starts/stops WireGuard, OpenVPN, and AmneziaWG tunnels. | `[VERIFIED CURRENT]` |
| **Engine** | Firewall & Kill-Switch | `internal/firewall/` | Manipulates iptables/nftables to block traffic outside the tunnel. | `[VERIFIED CURRENT]` |
| **Engine** | Routing | `internal/routing/` | Configures default gateway, policy tables, and subnet exclusions. | `[VERIFIED CURRENT]` |
| **Engine** | Port Forwarding | `internal/portforward/` | NAT-PMP port acquisition, lease renewal loop, port file writer. | `[VERIFIED CURRENT]` |
| **Engine** | DNS | `internal/dns/` | Encrypted DNS-over-TLS Unbound resolver and ad-blocking. | `[VERIFIED CURRENT]` |
| **Engine** | Public IP | `internal/publicip/` | Fetches public VPN IP, country, ISP, and geo-data. | `[VERIFIED CURRENT]` |
| **Dashboard** | Entrypoint | `cmd/gluetun-dashboard/main.go` | Parses dashboard env, starts coordinator, serves HTTP on `:9090`. | `[VERIFIED CURRENT]` |
| **Dashboard** | Engine Client | `internal/dashboard/gluetun/client.go` | HTTP adapter calling Gluetun control server port `8000`. | `[VERIFIED CURRENT]` |
| **Dashboard** | Mock Adapter | `internal/dashboard/gluetun/mock.go` | In-memory engine simulator with 8 realistic test scenarios. | `[VERIFIED CURRENT]` |
| **Dashboard** | State Coordinator | `internal/dashboard/state/coordinator.go` | Synchronizes engine polling, transition mutex, traffic, and SSE push. | `[VERIFIED CURRENT]` |
| **Dashboard** | Secret Redaction | `internal/dashboard/redaction/redact.go` | Regex and key dictionary filter scrubbing credentials and keys. | `[VERIFIED CURRENT]` |
| **Dashboard** | Profile Store | `internal/dashboard/profiles/store.go` | Persists non-secret connection profiles in `/data/profiles.json`. | `[VERIFIED CURRENT]` |
| **Dashboard** | Audit History | `internal/dashboard/history/store.go` | Ring-buffer persistence of IP changes, port updates, audits in `/data/history.json`. | `[VERIFIED CURRENT]` |
| **Dashboard** | Web Assets | `internal/dashboard/web/embed.go` | `go:embed` asset delivery with SPA client-side routing fallback. | `[VERIFIED CURRENT]` |
| **Frontend** | React SPA | `web/src/` | React 19 + Vite + TypeScript dark glassmorphism dashboard UI. | `[VERIFIED CURRENT]` |

---

## 3. Verified Communication Protocols

1. **Browser $\leftrightarrow$ Dashboard (`:9090`)**:
   - `[VERIFIED CURRENT]`: Standard HTTP/1.1 REST API + Server-Sent Events (`/api/dashboard/events/stream`).
   - `[VERIFIED CURRENT]`: Session cookie (`gluetun_session_id`) or `Authorization: Bearer` header.
   - `[VERIFIED CURRENT]`: Mutating requests (`POST`, `PUT`, `DELETE`) enforce `X-CSRF-Token` validation.
   - `[VERIFIED CURRENT]`: Fallback to 5-second polling with exponential backoff when SSE disconnects.

2. **Dashboard $\leftrightarrow$ Gluetun Engine (`:8000`)**:
   - `[VERIFIED CURRENT]`: HTTP REST client (`gluetun.RealClient`) targeting `http://<gluetun-host>:8000`.
   - `[VERIFIED CURRENT]`: Endpoints used: `/v1/version`, `/v1/vpn/status`, `/v1/vpn/settings`, `/v1/publicip/ip`, `/v1/portforward`, `/v1/dns/status`, `/v1/updater/status`.
   - `[VERIFIED CURRENT]`: Port 8000 is internal only; never exposed to host or browser.

3. **Engine $\leftrightarrow$ VPN Server**:
   - `[VERIFIED CURRENT]`: WireGuard UDP (`51820`), OpenVPN UDP/TCP, or AmneziaWG protocols over WAN.
