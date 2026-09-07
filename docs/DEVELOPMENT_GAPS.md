# Gluetun Control Center: Gap Analysis & Development Roadmap

This document catalogs what has been implemented, what remains partial or missing, and defines the recommended development roadmap based on verified repository findings.

---

## 1. Already Implemented

| Feature | Files | Key Symbols | Status |
|---|---|---|---|
| **Safe Go Management Backend** | `cmd/gluetun-dashboard/main.go`, `internal/dashboard/api/*` | `main()`, `NewAPIHandler()`, `NewRouter()` | `[VERIFIED CURRENT]` Fully functional |
| **Real Engine Client Adapter** | `internal/dashboard/gluetun/client.go` | `RealClient`, `GetVPNStatus()`, `SetVPNStatus()` | `[VERIFIED CURRENT]` Unit-tested & working |
| **Mock Engine Client Adapter** | `internal/dashboard/gluetun/mock.go` | `MockClient`, 8 mock scenarios | `[VERIFIED CURRENT]` Unit-tested & working |
| **State Synchronization & SSE** | `internal/dashboard/state/coordinator.go` | `Coordinator`, `Start()`, `broadcaster` | `[VERIFIED CURRENT]` Working with SSE & polling |
| **Secret Redaction Invariant** | `internal/dashboard/redaction/redact.go` | `RedactString()`, `RedactMap()`, regex filters | `[VERIFIED CURRENT]` 100% test coverage |
| **Session Auth & CSRF Protection** | `internal/dashboard/auth/auth.go`, `session.go` | `Authenticator`, `SessionStore`, `ValidateRequest()` | `[VERIFIED CURRENT]` Unit-tested & working |
| **Profiles & History Persistence** | `internal/dashboard/profiles/`, `history/` | `Store`, `Profile`, `HistoryEvent` | `[VERIFIED CURRENT]` Stored in `/data/*.json` |
| **Embedded React 19 Frontend** | `web/src/`, `internal/dashboard/web/embed.go` | `OverviewPage`, `ServersPage`, `PortForwardingPage`, `NetworkPage`, `ProfilesPage`, `ActivityPage`, `SettingsPage` | `[VERIFIED CURRENT]` Production build embedded in binary |
| **Container Hardening & Compose** | `Dockerfile.dashboard`, `docker-compose.dashboard.yml` | Multi-stage build, non-root user (`1000:1000`), `cap_drop: [ALL]`, read-only root | `[VERIFIED CURRENT]` Ready for deployment |

---

## 2. Partially Implemented

1. **Traffic Bandwidth Telemetry**:
   - *What exists*: In-memory rate smoothing (`internal/dashboard/state/traffic.go`), rolling 1m/15m/1h series, and UI charts (`TrafficChart.tsx`).
   - *What is incomplete*: Gluetun engine does not expose `/v1/traffic`. In containerized production, real interface counters require mounting `/sys/class/net` or host `/proc/net/dev`. Currently, mock data provides telemetry in demo mode, but engine mode displays zero traffic until a kernel statistics reader is attached.

2. **Server List Live Refresh**:
   - *What exists*: Direct storage querying of embedded server database (`Storage.GetServers`).
   - *What is incomplete*: Triggering `PUT /v1/updater/status` starts Gluetun's background server list updater, but does not yet signal the dashboard to hot-reload servers from disk without restarting the storage object.

---

## 3. Missing Components

1. **Multi-User Role-Based Access Control (RBAC)**:
   - Only a single admin user (`DASHBOARD_ADMIN_USERNAME`) is currently supported. Read-only viewer accounts do not yet exist.
2. **Prometheus Metrics Exporter for Dashboard State**:
   - Gluetun engine has Prometheus metrics (`internal/metrics`), but dashboard-specific metrics (active sessions, API latency, profile switch counts) are not yet exported.

---

## 4. Responsibility Boundaries

### Must Remain Gluetun Engine Responsibility
- **Kernel Networking**: WireGuard interface creation, OpenVPN subprocess execution, AmneziaWG protocol drivers.
- **Firewall Kill-Switch**: iptables / nftables default drop rules. The dashboard must **never** implement its own software firewall.
- **Routing & Namespaces**: Default gateway replacement and policy routing tables.
- **Encrypted DNS**: Unbound DNS-over-TLS resolver and ad-block list parsing.
- **NAT-PMP Protocol**: Cryptographic handshaking with VPN gateway to negotiate port forward leases.

### Must Remain Application Layer Responsibility
- **Browser User Interface**: Responsive glassmorphism web client.
- **Authentication & CSRF**: Session validation, cookie issuance, and mutation request guarding.
- **Audit Logging**: Chronological user action logs, IP change history, and port assignment history.
- **Profiles Management**: Non-secret user preference management and bulk JSON import/export.
- **Sanitization & Redaction**: Ensuring engine secrets (private keys, passwords) never escape to the browser.

---

## 5. Recommended Next Development Steps

### Step 1: Kernel Traffic Counter Adapter
- **Goal**: Read Linux network interface transfer counters (`/proc/net/dev` or `sysfs`) for `tun0` to populate live traffic charts when running against a real engine.
- **Files Affected**: `internal/dashboard/state/traffic.go`.
- **Completion Criteria**: Real download/upload rates displayed on OverviewPage when connected.

### Step 2: Storage Reload on Updater Completion
- **Goal**: Reload `storage.Storage` when Gluetun's server updater finishes.
- **Files Affected**: `internal/dashboard/state/coordinator.go`.
- **Completion Criteria**: New servers retrieved by the updater appear immediately in the Servers Explorer.

### Step 3: Granular Read-Only Viewer Accounts
- **Goal**: Support secondary read-only tokens for status dashboards and monitoring displays.
- **Files Affected**: `internal/dashboard/auth/auth.go`, `internal/dashboard/api/router.go`.
- **Completion Criteria**: Viewer accounts can view status and servers, but mutate operations return `403 Forbidden`.
