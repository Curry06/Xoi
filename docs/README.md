# Gluetun Control Center Documentation

Welcome to the **Gluetun Control Center** documentation. This suite of documents details the architecture, API design, security guarantees, setup instructions, and verified engine capabilities of the Gluetun Control Center.

---

## Documentation Index

| Document | Description |
|---|---|
| **[Setup & Quickstart](file:///home/vedx/Videos/Gul/docs/setup.md)** | Step-by-step instructions for running standalone mock mode, local development (Vite + Go), Docker Compose production deployment, and automated test commands. |
| **[Architecture & Subsystems](file:///home/vedx/Videos/Gul/docs/architecture.md)** | System topology diagram, frontend-backend relationship, State Coordinator, concurrency mutex locks, traffic metrics, and Server-Sent Events (SSE) streaming. |
| **[Safe Management API](file:///home/vedx/Videos/Gul/docs/api.md)** | Full endpoint catalog for `/api/dashboard/*`, request/response JSON schemas, CSRF protection headers, session cookies, and standard error formats. |
| **[Security & Hardening](file:///home/vedx/Videos/Gul/docs/security.md)** | Threat model, non-root user execution (`1000:1000`), read-only filesystem, dropping Linux capabilities, secret redaction invariants, and port 8000 isolation. |
| **[Route & Capability Matrix](file:///home/vedx/Videos/Gul/docs/route-capability-matrix.md)** | Verified mapping between Gluetun engine endpoints (`/v1/vpn/*`, `/v1/publicip/*`, `/v1/portforward`, etc.) and dashboard UI capabilities. |

---

## Quick Reference Commands

### Run Standalone Mock Mode (No VPN Required)
```bash
GLUETUN_MOCK=true \
DASHBOARD_AUTH_REQUIRED=false \
DASHBOARD_HTTP_ADDRESS=127.0.0.1:9090 \
go run ./cmd/gluetun-dashboard
```
Access UI at `http://127.0.0.1:9090`.

### Run Production Stack with Docker Compose
```bash
# 1. Provide secrets
mkdir -p secrets
echo "YOUR_WIREGUARD_KEY" > secrets/wireguard_private_key.txt
echo "admin_password" > secrets/dashboard_admin_password.txt

# 2. Launch stack
docker compose -f docker-compose.dashboard.yml up -d --build
```

### Run Tests & Verification
```bash
# Go backend tests (all packages)
go test -v ./internal/dashboard/...

# Frontend tests & type-checking
npm --prefix web test
npm --prefix web run lint

# Frontend production build (outputs to embedded dist)
npm --prefix web run build
```

---

## Project Structure

```text
Gul/
├── cmd/
│   └── gluetun-dashboard/      # Go entrypoint, env loading, signal handling
├── internal/
│   └── dashboard/
│       ├── api/                # REST endpoints, error models, CSRF middleware
│       ├── auth/               # Session store, cookie/bearer auth
│       ├── gluetun/            # Engine client adapter (RealClient & MockClient)
│       ├── history/            # Audit trail & IP/port history persistence
│       ├── profiles/           # Safe user profiles persistence
│       ├── redaction/          # Automated regex & key secret sanitization
│       ├── state/              # Coordinator, mutex locks, telemetry, SSE stream
│       └── web/                # Go embed.FS wrapper serving frontend assets
├── web/
│   ├── src/
│   │   ├── api/                # TypeScript API client & error mapping
│   │   ├── components/         # Modals, Toast, QR code, Traffic charts
│   │   ├── hooks/              # useLiveState (SSE + 5s polling fallback)
│   │   ├── layouts/            # DashboardLayout (Sidebar, navigation, badges)
│   │   ├── pages/              # Overview, Servers, PortForwarding, Network,
│   │   │                       # Profiles, Activity, Settings
│   │   ├── styles/             # Dark glassmorphism design system
│   │   ├── types/              # Unified TypeScript interfaces
│   │   └── utils/              # Pure formatting helpers (bytes, rate, uptime)
│   └── __tests__/              # Node 24 native TypeScript unit tests
├── Dockerfile.dashboard        # Multi-stage hardened production container
├── docker-compose.dashboard.yml# Production deployment stack
├── .env.example                # Configuration template
└── docs/                       # Comprehensive documentation suite
```
