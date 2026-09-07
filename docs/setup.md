# Gluetun Control Center: Setup & Development Guide

This guide walks you through setting up, developing, and running Gluetun Control Center either in local mock mode or with a production Gluetun container.

---

## 1. Quick Start: Standalone Mock Mode (No VPN Required)

Mock mode allows full development of the frontend and API without touching network adapters or running a VPN container.

### Step 1: Run the Go Backend with Mock Mode
```bash
GLUETUN_MOCK=true \
DASHBOARD_AUTH_REQUIRED=false \
DASHBOARD_HTTP_ADDRESS=127.0.0.1:9090 \
go run ./cmd/gluetun-dashboard
```

### Step 2: Open the Web UI
Open your browser at `http://127.0.0.1:9090`.
You will see the **DEMO DATA** banner in the header, with realistic mock data for WireGuard, ProtonVPN, port forwarding, and network telemetry.

---

## 2. Production Deployment via Docker Compose

### Step 1: Create Secrets Directory
```bash
mkdir -p secrets
echo "YOUR_WIREGUARD_PRIVATE_KEY_HERE" > secrets/wireguard_private_key.txt
echo "your_super_secret_admin_password" > secrets/dashboard_admin_password.txt
chmod 600 secrets/*
```

### Step 2: Configure Environment (.env)
Copy the template and modify options as needed:
```bash
cp .env.example .env
```

### Step 3: Launch Stack
```bash
docker compose -f docker-compose.dashboard.yml up -d --build
```

### Step 4: Access Dashboard
Navigate to `http://127.0.0.1:9090`.
Log in with username `admin` and the password configured in `secrets/dashboard_admin_password.txt`.

---

## 3. Local Development Workflow

### Frontend Development (Vite HMR)
1. Install dependencies:
   ```bash
   cd web
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Vite runs at `http://localhost:5173` and proxies `/api` requests to `http://127.0.0.1:9090`.

### Backend Development
Run the Go daemon:
```bash
go run ./cmd/gluetun-dashboard
```

---

## 4. Running Automated Tests & Verification

### Backend Tests
```bash
go test -v ./internal/dashboard/...
```

### Frontend Tests & Type Checking
```bash
# Run unit tests
npm --prefix web test

# Run TypeScript type check
npm --prefix web run lint

# Build production bundle
npm --prefix web run build
```

---

## 5. Mock Scenarios

In mock mode, you can toggle between different operational scenarios directly from the **Settings Page**:

* `connected`: Healthy WireGuard connection with assigned port `45220`.
* `connecting`: Transient connection handshaking state.
* `disconnected`: Tunnel stopped, kill-switch engaged.
* `port_unavailable`: Connected tunnel where port forwarding is pending or unsupported.
* `ip_unavailable`: Connected tunnel during public IP lookup resolution.
* `reconnecting`: Automatic reconnection cycle.
* `degraded_dns`: DNS resolver degraded warning.
* `server_switch_error`: Simulates a failure when attempting a server switch.
