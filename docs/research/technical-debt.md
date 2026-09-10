# Technical Debt & Architecture Gaps

This document catalogs technical debt, architectural discrepancies, legacy code, and uncompleted integrations identified during deep-dive codebase analysis.

---

## 1. High Priority Debt

### 1.1. Reverse Proxy Ingress (`internal/proxy`) Unconnected in Dashboard Main
- **Location**: [`cmd/gluetun-dashboard/main.go`](file:///home/vedx/Videos/Gul/cmd/gluetun-dashboard/main.go#L170-L180), [`internal/dashboard/api/proxy_handlers.go`](file:///home/vedx/Videos/Gul/internal/dashboard/api/proxy_handlers.go#L30-L35)
- **Issue**: The proxy manager (`proxy.Manager`) and Caddy integration (`proxy.CaddyProvider`) are fully implemented and unit-tested in `internal/proxy/`, and API routes are registered in `router.go`. However, `cmd/gluetun-dashboard/main.go` does not initialize `proxy.NewManager()` or call `apiHandler.SetProxyManager(mgr)`.
- **Impact**: Any invocation of `/api/dashboard/proxy/*` endpoints returns `503 Service Unavailable: Reverse proxy manager is not initialized`.
- **Remediation**: Add initialization logic in `cmd/gluetun-dashboard/main.go` with optional environment toggle `PROXY_ENABLED=true` (defaulting to false if Caddy is not present).

### 1.2. Frontend State Duplication (`useLiveState` vs `useVPNState`)
- **Location**: [`web/src/hooks/useLiveState.ts`](file:///home/vedx/Videos/Gul/web/src/hooks/useLiveState.ts), [`web/src/hooks/useVPNState.ts`](file:///home/vedx/Videos/Gul/web/src/hooks/useVPNState.ts), [`web/src/services/simulationEngine.ts`](file:///home/vedx/Videos/Gul/web/src/services/simulationEngine.ts)
- **Issue**: There are two parallel state layers in the frontend:
  1. `useLiveState`: Subscribes to real SSE `/api/dashboard/events/stream` and engine snapshots.
  2. `useVPNState`: Blends mock simulation engine state (`simulationEngine.ts`) with live snapshots when `useLiveEngine` is toggled.
- **Impact**: Some granular UI components (e.g. `ActiveConnectionsView`, `DevicesView`, `RoutingView`, `FirewallView`, `SecurityView`) consume fields from `vpnState` that are populated by the client simulation engine rather than live engine telemetry.
- **Remediation**: Unify state into a single typed state store where live engine telemetry is primary, and simulation data is strictly an explicit dev-mode fallback.

---

## 2. Medium Priority Debt

### 2.1. Kernel Interface Traffic Counter Gap
- **Location**: [`internal/dashboard/state/traffic.go`](file:///home/vedx/Videos/Gul/internal/dashboard/state/traffic.go)
- **Issue**: The Gluetun engine does not expose `/v1/traffic` bandwidth statistics over its HTTP control server. The dashboard's `TrafficMonitor` has smoothing and sliding window rate calculation logic, but reading raw bytes from `/proc/net/dev` or sysfs requires either mounting `/sys/class/net` into the dashboard container or having the engine report telemetry. In production without volume mounts, traffic rates appear as 0 Mbps unless running in mock mode.
- **Remediation**: Add a small netlink/sysfs reader or implement an engine-side telemetry collector exported via Prometheus or `/v1/metrics`.

### 2.2. Single-User Authentication (No Multi-User RBAC)
- **Location**: [`internal/dashboard/auth/auth.go`](file:///home/vedx/Videos/Gul/internal/dashboard/auth/auth.go)
- **Issue**: The dashboard authenticator supports only a single username (`DASHBOARD_ADMIN_USERNAME`) and password (`DASHBOARD_ADMIN_PASSWORD`). There is no concept of read-only viewer roles, multi-user accounts, or OAuth/OIDC delegation.
- **Remediation**: Introduce a user store or API key table supporting `admin` and `viewer` permissions.

### 2.3. Server List Hot-Reloading After Updater Execution
- **Location**: [`internal/dashboard/state/coordinator.go`](file:///home/vedx/Videos/Gul/internal/dashboard/state/coordinator.go), [`internal/storage/servers.go`](file:///home/vedx/Videos/Gul/internal/storage/servers.go)
- **Issue**: When a user triggers `PUT /v1/updater/status` to update VPN server lists, the Gluetun engine downloads and unpacks fresh server definitions to disk. However, the dashboard instance of `storage.Storage` does not automatically reload its in-memory cache without a restart.
- **Remediation**: Add a reload hook or file watcher on `/gluetun/servers.json` in the dashboard storage instance.

---

## 3. Low Priority Debt & Cleanups

### 3.1. Legacy Routes and Aliases
- **Location**: [`internal/server/handlerv0.go`](file:///home/vedx/Videos/Gul/internal/server/handlerv0.go)
- **Issue**: `handlerv0.go` retains backwards-compatibility routes for v0 endpoints (`/openvpn/actions/restart`, `/dns/actions/restart`, etc.) that were superseded by `/v1/*`.
- **Status**: Kept for backwards compatibility with older orchestrators.

### 3.2. Temporary and Untracked Files in Git
- **Location**: `internal/proxy/`, `web/src/__tests__/vpn_dashboard.test.ts`, `web/src/components/*`
- **Issue**: New features are partially staged across git untracked files and unstaged edits in `web/`.
- **Status**: Identified during git inspection.
