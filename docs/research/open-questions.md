# Open Questions & Investigation Log

This document records architectural questions, unconfirmed runtime behaviors, and future investigation areas.

---

## 1. Open Questions

### Question 001: Production Ingress Proxy Architecture
- **Description**: How will the Caddy reverse proxy (`internal/proxy`) run in production? Will Caddy run as a sidecar container sharing Gluetun's network namespace (`network_mode: "service:gluetun"`), or will Caddy be embedded directly inside the Gluetun or Dashboard container?
- **Current Evidence**: `docker-compose.dashboard.yml` does not currently define a `caddy` service. `internal/proxy/caddy.go` expects an admin API at `http://127.0.0.1:2019`.
- **Status**: `[UNKNOWN]`
- **Recommended Action**: Clarify deployment topology for the dynamic ingress proxy before enabling `apiHandler.SetProxyManager`.

### Question 002: Kernel Traffic Counter Permissions in Non-Root Containers
- **Description**: `Dockerfile.dashboard` runs as `USER 1000:1000` with `cap_drop: [ALL]` and `read_only: true`. Can this container read `/sys/class/net/tun0/statistics/rx_bytes` if mounted read-only, or does it require additional capabilities or engine-level telemetry exports?
- **Current Evidence**: Reading `/sys/class/net` from inside another container's unprivileged user requires volume mounting and read permissions on sysfs files.
- **Status**: `[INFERRED]` (Engine-side export via `/v1/metrics` or REST is significantly cleaner and avoids container capability compromises).

### Question 003: Multi-Provider Port Forwarding Protocol Variations
- **Description**: Currently, ProtonVPN uses NAT-PMP, while Private Internet Access (PIA) uses a signature-based token API (`utils.PortForwardObjects`). Are other providers planned for port forwarding in the dashboard UI?
- **Current Evidence**: `internal/provider/` has provider-specific port forwarding implementations in `protonvpn/` and `privateinternetaccess/`.
- **Status**: `[VERIFIED CURRENT]` for ProtonVPN and PIA. Other providers have `can_port_forward = false`.

---

## 2. Unknowns Catalog

| Topic | Current State | Code Verification Status | Next Step |
|---|---|---|---|
| Ingress Proxy Container Topology | Implemented in Go, omitted in compose | `[UNKNOWN]` | Add compose service definition |
| Real Traffic Telemetry Export | Mocked in frontend, in-memory in dashboard | `[HIGH CONFIDENCE]` needs engine metrics | Implement engine `/v1/traffic` or `/proc/net/dev` mount |
| Multi-tenancy / RBAC | Single admin only | `[VERIFIED CURRENT]` | Define user management spec |
