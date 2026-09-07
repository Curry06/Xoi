# Gluetun Control Center: Production Server Deployment Guide

This guide provides complete, step-by-step instructions for deploying the **Gluetun Control Center** stack onto a Linux server (VPS, dedicated server, home lab, or cloud instance).

---

## 1. Server Prerequisites

Ensure your host server meets the following requirements:

- **Operating System**: Modern Linux (Ubuntu 22.04+, Debian 12+, Rocky Linux, Alpine, etc.)
- **Docker**: Docker Engine 24.0+
- **Docker Compose**: Docker Compose V2 plugin (`docker compose`)
- **Kernel TUN Module**: The Linux TUN network device must be available for VPN tunnel creation.

Verify on your server:

```bash
# Check Docker and Compose installation
docker --version
docker compose version

# Verify the Linux TUN device exists
ls -l /dev/net/tun
```

> **Note**: If `/dev/net/tun` does not exist, enable the kernel module:
> ```bash
> sudo modprobe tun
> echo "tun" | sudo tee -a /etc/modules
> ```

---

## 2. Transfer / Clone the Project to the Server

Clone the repository to your chosen server path (for example, `/opt/gluetun`):

```bash
git clone <YOUR_GIT_REPO_URL> /opt/gluetun
cd /opt/gluetun
```

---

## 3. Configure Secrets (Zero Secrets in Version Control)

The stack uses Docker secrets so passwords and cryptographic private keys are never stored in environment variables, process trees, or Git history.

```bash
# 1. Create secrets directory
mkdir -p secrets

# 2. Add your WireGuard or OpenVPN private key
echo "YOUR_WIREGUARD_PRIVATE_KEY_HERE" > secrets/wireguard_private_key.txt

# 3. Add your desired dashboard admin password
echo "YourStrongAdminPasswordHere" > secrets/dashboard_admin_password.txt

# 4. Secure the file permissions (read/write by owner only)
chmod 600 secrets/*
```

---

## 4. Configure Your VPN Provider

Open [`docker-compose.dashboard.yml`](file:///home/vedx/Videos/Gul/docker-compose.dashboard.yml) and configure your VPN provider credentials in the `gluetun` service section:

### ProtonVPN (Example):
```yaml
environment:
  - VPN_SERVICE_PROVIDER=protonvpn
  - VPN_TYPE=wireguard
  - WIREGUARD_PRIVATE_KEY_FILE=/run/secrets/wireguard_private_key
  - SERVER_COUNTRIES=Netherlands
  - PORT_FORWARD_ONLY=on
  - VPN_PORT_FORWARDING=on
  - VPN_PORT_FORWARDING_PROVIDER=protonvpn
  - HTTP_CONTROL_SERVER_ADDRESS=0.0.0.0:8000
```

### Mullvad (Example):
```yaml
environment:
  - VPN_SERVICE_PROVIDER=mullvad
  - VPN_TYPE=wireguard
  - WIREGUARD_PRIVATE_KEY_FILE=/run/secrets/wireguard_private_key
  - WIREGUARD_ADDRESSES=10.64.x.x/32
  - SERVER_CITIES=Amsterdam
  - HTTP_CONTROL_SERVER_ADDRESS=0.0.0.0:8000
```

> For other providers (AirVPN, PIA, Surfshark, Cyberghost, Custom, etc.), consult the official [Gluetun Provider Documentation](https://github.com/qdm12/gluetun-wiki).

---

## 5. Build & Launch the Containers

Start the production stack using Docker Compose:

```bash
docker compose -f docker-compose.dashboard.yml up -d --build
```

Compose will:
1. Compile the React 19 frontend into optimized production assets.
2. Build the lightweight Go binary embedding the web UI.
3. Package the dashboard into a minimal Alpine container running as non-root (`1000:1000`).
4. Start the Gluetun VPN engine container and establish the tunnel.
5. Launch the dashboard once Gluetun passes its health check.

---

## 6. Verify Service Health & Connectivity

Run the following checks to confirm the tunnel and dashboard are operating properly:

```bash
# 1. Check container health statuses
docker compose -f docker-compose.dashboard.yml ps

# 2. View Gluetun engine logs (verify tunnel handshake)
docker compose -f docker-compose.dashboard.yml logs -f gluetun

# 3. View dashboard logs
docker compose -f docker-compose.dashboard.yml logs -f dashboard

# 4. Verify public IP through the VPN tunnel
docker exec -it gluetun-engine wget -qO- https://ipinfo.io
```

---

## 7. Remote Access & Security Options

By default, the dashboard port `9090` is bound strictly to `127.0.0.1:9090` on the server host so it is never exposed directly to the public internet without encryption.

### Option A: SSH Tunneling (Fastest & Most Secure)
From your local workstation, run:
```bash
ssh -L 9090:127.0.0.1:9090 user@your-server-ip
```
Then open **`http://localhost:9090`** in your browser.

### Option B: Private Mesh VPN (Tailscale / Netbird / WireGuard)
If your server is part of a private mesh network, bind the dashboard port to your server's mesh IP in `docker-compose.dashboard.yml`:
```yaml
ports:
  - "100.x.y.z:9090:9090"
```

### Option C: Reverse Proxy with HTTPS (Caddy / Nginx / Traefik)
If exposing via a domain name (e.g., `vpn.yourdomain.com`), terminate TLS with a reverse proxy:

**Caddyfile example**:
```caddy
vpn.yourdomain.com {
    reverse_proxy 127.0.0.1:9090
}
```

**Nginx example**:
```nginx
server {
    listen 443 ssl http2;
    server_name vpn.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vpn.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vpn.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket / Server-Sent Events (SSE) support
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

---

## 8. Routing Other Application Containers Through Gluetun

To force any other container's traffic through the VPN tunnel, set its `network_mode` to `service:gluetun`:

```yaml
services:
  qbittorrent:
    image: linuxserver/qbittorrent:latest
    container_name: qbittorrent
    restart: unless-stopped
    network_mode: "service:gluetun"
    depends_on:
      gluetun:
        condition: service_healthy
    environment:
      - PUID=1000
      - PGID=1000
      - WEBUI_PORT=8080
    volumes:
      - ./appdata/qbittorrent:/config
      - /data/downloads:/downloads
```

*Note*: When using `network_mode: "service:gluetun"`, any web ports for that application (e.g. port `8080`) must be mapped on the `gluetun` service in `docker-compose.dashboard.yml`.

---

## 9. Day-to-Day Maintenance Commands

```bash
# View live logs for all services
docker compose -f docker-compose.dashboard.yml logs -f

# Restart only the dashboard (keeps the VPN tunnel alive)
docker compose -f docker-compose.dashboard.yml restart dashboard

# Restart the entire VPN and dashboard stack
docker compose -f docker-compose.dashboard.yml restart

# Pull latest base images and rebuild stack
docker compose -f docker-compose.dashboard.yml pull
docker compose -f docker-compose.dashboard.yml up -d --build

# Stop the stack
docker compose -f docker-compose.dashboard.yml down
```
