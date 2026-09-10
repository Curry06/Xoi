# Architecture: System Overview

## 1. Executive Summary

This project is a high-security, containerized VPN client gateway and management control center. It solves two critical challenges:
1. **Kernel-Level VPN & Network Protection**: It routes containerized or host network traffic through WireGuard, OpenVPN, or AmneziaWG encrypted tunnels while enforcing an immutable iptables/nftables kill-switch that prevents data and DNS leaks.
2. **Safe, Production-Ready Web Operations**: It provides a modern browser management UI (Gluetun Control Center) and REST/SSE API that allows operators to inspect status, switch servers, monitor dynamic port forwarding, and configure notifications without exposing kernel control ports or cryptographic secrets.

---

## 2. System Topology & Process Boundaries

The repository compiles into **two separate, isolated server processes**:

```mermaid
flowchart TB
    subgraph Host["Host / Docker Host Environment"]
        subgraph BrowserClient["Browser Client / Operator"]
            UI["React 19 SPA (Dark Glassmorphism UI)"]
        end

        subgraph DashboardContainer["Dashboard Container (gluetun-control-center)"]
            direction TB
            D_HTTP["HTTP & SSE Server (:9090)<br/>cmd/gluetun-dashboard"]
            D_AUTH["Session Auth & CSRF Middleware<br/>auth/"]
            D_COORD["State Coordinator & Mutex Lock<br/>state/"]
            D_REDACT["Secret Redaction Filter<br/>redaction/"]
            D_DATA[("/data Persistent JSON Stores<br/>profiles.json, history.json")]
            D_NOTIF["Telegram Notifier<br/>notify/"]

            D_HTTP --> D_AUTH
            D_AUTH --> D_COORD
            D_COORD --> D_REDACT
            D_COORD --> D_DATA
            D_COORD --> D_NOTIF
        end

        subgraph PrivateNet["Private Docker Bridge: 'vpn-management'"]
            D_CLIENT["Internal HTTP Client Adapter<br/>gluetun/client.go"]
        end

        subgraph EngineContainer["VPN Engine Container (gluetun-engine)"]
            direction TB
            E_SERVER["HTTP Control Server (:8000)<br/>server/"]
            E_LOOP["VPN Life Cycle Run Loop<br/>vpn/"]
            E_FW["Firewall Kill-Switch (DROP)<br/>firewall/"]
            E_ROUTE["Kernel Routing Table Manager<br/>routing/"]
            E_TUN["Tunnel Interface (tun0 / wg0)<br/>tun/ & netlink/"]
            E_DNS["Encrypted DNS-over-TLS (Unbound)<br/>dns/"]
            E_PF["NAT-PMP Port Forwarding Loop<br/>portforward/"]
            E_PIP["Public IP Telemetry Getter<br/>publicip/"]

            E_SERVER --> E_LOOP
            E_LOOP --> E_FW
            E_LOOP --> E_ROUTE
            E_LOOP --> E_TUN
            E_LOOP --> E_DNS
            E_LOOP --> E_PF
            E_LOOP --> E_PIP
        end

        subgraph RoutedApps["Routed Applications (network_mode: 'service:gluetun')"]
            APP1["Application Container A"]
            APP2["Application Container B"]
        end
    end

    subgraph WAN["External World (Internet)"]
        VPN_GW["VPN Server / Gateway<br/>(WireGuard / OpenVPN)"]
        TG_API["Telegram Bot API<br/>api.telegram.org"]
        INT_NET["Internet Target Services"]
    end

    %% Connections
    UI <-->|HTTP REST & SSE (127.0.0.1:9090)| D_HTTP
    D_COORD --> D_CLIENT
    D_CLIENT <-->|HTTP REST (:8000)| E_SERVER
    D_NOTIF -->|HTTPS (:443)| TG_API

    APP1 & APP2 -->|Shares Network Namespace| E_TUN
    E_TUN <-->|Encrypted UDP Tunnel (:51820)| VPN_GW
    VPN_GW <--> INT_NET
```

---

## 3. The Core Invariants

The architecture is built upon five non-negotiable architectural invariants:

### Invariant 1: Kernel Isolation Boundary
The browser client and management API **never** communicate directly with the privileged engine port (`:8000`), nor do they execute host network commands (`iptables`, `ip route`, `wg`). Port `:8000` is strictly private to the Docker bridge network `vpn-management` and is never exposed on host interfaces.

### Invariant 2: Automated Secret Redaction Airlock
VPN configurations contain sensitive material: WireGuard private keys, pre-shared keys, OpenVPN passwords, and provider API tokens. All engine responses passing through the dashboard backend are filtered through [`internal/dashboard/redaction/redact.go`](file:///home/vedx/Videos/Gul/internal/dashboard/redaction/redact.go). Secrets are permanently replaced with `[REDACTED]` before leaving memory.

### Invariant 3: Kernel Kill-Switch Invariant
The kill-switch is not an application polling loop. It is an immutable kernel iptables/nftables policy set at startup:
- `INPUT`, `OUTPUT`, and `FORWARD` chains in `filter` table default to `DROP`.
- Existing conntrack sockets are flushed on initialization.
- If the tunnel drops, crashes, or is stopped by the user, the kernel drops all un-tunneled outbound traffic, preventing plaintext IP leaks.

### Invariant 4: State Serialization & Atomic Transitions
State transitions (connecting, disconnecting, switching servers, applying profiles) acquire an atomic mutex lock in [`Coordinator.TryLockOperation`](file:///home/vedx/Videos/Gul/internal/dashboard/state/coordinator.go). Concurrent mutating operations return `409 Conflict`. Transient states (`connecting`, `disconnecting`, `reconnecting`) are broadcast to all clients in real-time via Server-Sent Events.

### Invariant 5: Safe Port Forwarding Representation
Port forwarding is dynamic. Providers (such as ProtonVPN via NAT-PMP) report port `0` while establishing a lease. The dashboard sanitizes this: port `0` is never treated as active, and QR codes or public endpoint cards are rendered only when a verified port in range `1–65535` is assigned.

---

## 4. Key Subsystem Interactions

| Subsystem | Binary / Directory | Port | User Context | Primary Responsibility |
|---|---|---|---|---|
| **VPN Engine** | `cmd/gluetun` / `internal/*` | `:8000` (internal) | Root (`CAP_NET_ADMIN`) | Tunnel interface, iptables kill-switch, routing tables, encrypted DNS, NAT-PMP port forwarding. |
| **Control Center** | `cmd/gluetun-dashboard` / `internal/dashboard/*` | `:9090` (loopback) | Unprivileged (`1000:1000`) | Embedded React 19 SPA, session auth, CSRF validation, state coordination, secret redaction, audit logging, Telegram alerts. |
| **Ingress Proxy** | `internal/proxy/*` | `:8080` (ingress) | Unprivileged | Dynamic Caddy-based reverse proxy routing traffic from forwarded VPN port to internal app targets. |
| **Routed Apps** | External containers | None (shared namespace) | Varies | Downstream containers sharing Gluetun's network namespace (`network_mode: "service:gluetun"`). |
