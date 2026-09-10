# Research Findings

## Finding 001 — Dual production binaries

**Observed:** `cmd/gluetun` owns privileged VPN networking; `cmd/gluetun-dashboard`
owns the unprivileged HTTP/SSE control plane and embedded SPA.

**Evidence:** both mains, both Dockerfiles, and Compose services.

**Confidence:** **VERIFIED**.

## Finding 002 — Dynamic forwarding endpoint

**Observed:** Proton provider creates NAT-PMP TCP/UDP mappings for 60 seconds
and renews after 45 seconds. Dashboard reads public IP and port from native API
and updates proxy endpoint state without storing it on routes.

**Evidence:** `internal/provider/protonvpn/portforward.go`, coordinator, proxy.

**Confidence:** **VERIFIED**.

## Finding 003 — One dynamic Caddy

**Observed:** Compose runs one Caddy in Gluetun's namespace. Manager validates
all routes, dynamically loads a complete Caddy configuration, persists JSON,
and reconciles every 15 seconds.

**Evidence:** `docker-compose.dashboard.yml`, `internal/proxy/*`.

**Confidence:** **VERIFIED**.

## Finding 004 — Frontend simulation boundary

**Observed:** live snapshots use SSE/polling, but many detailed UI panels come
from a browser simulation engine unless the user enables live mode.

**Evidence:** `useLiveState.ts`, `useVPNState.ts`, `simulationEngine.ts`.

**Confidence:** **VERIFIED**.
