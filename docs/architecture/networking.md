# Architecture: Networking Deep Dive

This document details the Linux network namespaces, interfaces, kernel routing tables, iptables firewall policies, and packet paths implemented in the codebase.

---

## 1. Network Namespaces & Docker Topology

Gluetun creates an isolated network bastion inside Docker:

```mermaid
flowchart TD
    subgraph Host["Docker Host (Host Network Namespace)"]
        DockerBridge["Docker Bridge (172.20.0.0/16)<br/>docker0 / veth interfaces"]
    end

    subgraph GluetunNS["Gluetun Container Network Namespace"]
        ETH["eth0 (172.20.0.2)<br/>Docker internal IP"]
        LO["lo (127.0.0.1)<br/>Loopback"]
        TUN["tun0 / wg0<br/>VPN Interface (e.g. 10.2.0.2)"]
        FW["Linux Netfilter / iptables<br/>Default Policy: DROP"]
        ROUTE["Policy Routing Rules & Tables"]
    end

    subgraph RoutedAppNS["Routed App (network_mode: 'service:gluetun')"]
        AppProc["Application Process (e.g. torrent/media)<br/>Shares Gluetun's exact network stack"]
    end

    subgraph DashboardNS["Dashboard Container Namespace"]
        DashETH["eth0 (172.20.0.3)<br/>Reaches Gluetun :8000 over bridge"]
    end

    DockerBridge <--> ETH
    DockerBridge <--> DashETH
    ETH <--> FW
    FW <--> ROUTE
    ROUTE <--> TUN
    AppProc -->|Uses lo or tun0 directly| TUN
```

### Namespace Sharing Semantics
- When an application container specifies `network_mode: "service:gluetun"`, the Docker daemon attaches it directly to Gluetun's network namespace (`/proc/<gluetun_pid>/ns/net`).
- The routed application does not have an `eth0` of its own; its `eth0` and `tun0` are identical to Gluetun's.
- If Gluetun's process exits, all routed application sockets immediately fail.

---

## 2. Kernel Firewall & Kill-Switch Policies

Implemented in [`internal/firewall/enable.go`](file:///home/vedx/Videos/Gul/internal/firewall/enable.go):

### 2.1. Default Drop Rule
On initialization, Gluetun sets the default policy of the `filter` table:
```bash
iptables -P INPUT DROP
iptables -P OUTPUT DROP
iptables -P FORWARD DROP
ip6tables -P INPUT DROP
ip6tables -P OUTPUT DROP
ip6tables -P FORWARD DROP
```

### 2.2. Conntrack Flush
To prevent existing sockets from leaking packets via the `ESTABLISHED,RELATED` rule, Gluetun flushes the kernel conntrack state:
```go
// [VERIFIED CURRENT] internal/firewall/flush.go
c.netLinker.FlushConntrack()
```

### 2.3. Allowed Rules
1. **Loopback**: Full access on `lo` interface (`iptables -A INPUT -i lo -j ACCEPT`, `iptables -A OUTPUT -o lo -j ACCEPT`).
2. **VPN Server Endpoint**: Allows outbound UDP/TCP to the designated VPN server IP and port over `eth0`.
3. **Local Networks**: Allows traffic to configured local subnets (e.g. `192.168.1.0/24`, `10.0.0.0/8`, `172.16.0.0/12`) so local hosts can access exposed services.
4. **Tunnel Interface**: Allows all input and output traffic through the tunnel interface (`tun0` or `wg0`).

---

## 3. Kernel Routing & Gateway Management

Implemented in [`internal/routing/`](file:///home/vedx/Videos/Gul/internal/routing/):

1. **Default Route Replacement**: The default route is directed via the VPN tunnel gateway IP (e.g. `10.2.0.1`), ensuring that all standard traffic is tunneled.
2. **Policy Routing Tables**: Custom routing tables (such as table `51820` for WireGuard or custom routing marks) isolate VPN traffic from local management traffic.
3. **Subnet Exclusions**: If `FIREWALL_OUTBOUND_SUBNETS` are specified, ip rules (`ip rule add to <subnet> table main priority <prio>`) are installed to route LAN traffic directly through `eth0` without entering the tunnel.

---

## 4. End-to-End Packet Flows

### 4.1. Outbound Traffic Path (Egress)
When an application container initiates an outbound HTTP/TLS connection:

```mermaid
sequenceDiagram
    participant App as Application Container (Routed App)
    participant NS as Shared Network Namespace
    participant FW as Iptables Filter
    participant Tun as Tunnel Interface (tun0 / wg0)
    participant Eth as Docker eth0
    participant VPN as VPN Gateway Server
    participant Web as Target Internet Host

    App->>NS: Socket write to target IP:443
    NS->>FW: Evaluate OUTPUT rule
    Note over FW: Kill-switch verifies route points to tun0
    FW->>Tun: Packet routed to tun0
    Tun->>Eth: Encapsulated & encrypted in Wireguard/OpenVPN UDP packet (port 51820)
    Eth->>VPN: Encrypted UDP packet sent over WAN
    VPN->>Web: Decapsulated packet egresses to Target Host with VPN Public IP
    Web-->>VPN: Response returned to VPN Public IP
    VPN-->>Eth: Encrypted packet received
    Eth-->>Tun: Decapsulated
    Tun-->>App: Received by Application socket
```

### 4.2. Inbound Traffic Path via Dynamic Port Forwarding (Ingress)
When an external client connects to an internal application through the VPN forwarded port:

```mermaid
sequenceDiagram
    participant Ext as External Client on Internet
    participant VPN as VPN Gateway
    participant PF as NAT-PMP Protocol Loop
    participant Tun as tun0 Interface
    participant IPT as Iptables DNAT
    participant Proxy as Caddy Ingress Proxy (:8080)
    participant App as Target App Container (:3000)

    PF->>VPN: Negotiate NAT-PMP lease (e.g. public port 45823)
    VPN-->>PF: Lease confirmed for 60s
    Ext->>VPN: TCP SYN to <VPN_Public_IP>:45823
    VPN->>Tun: Tunnel encapsulates packet to container tun0
    Tun->>IPT: Arrives at PREROUTING chain
    IPT->>IPT: DNAT redirect: port 45823 -> port 8080
    IPT->>Proxy: Delivered to Caddy Reverse Proxy listening on :8080
    Proxy->>App: Caddy reverse-proxies HTTP request to Target App:3000
    App-->>Proxy: HTTP Response
    Proxy-->>Tun: Return packet
    Tun-->>VPN: Return packet
    VPN-->>Ext: Delivered to External Client
```

---

## 5. DNS Resolution & Leak Prevention

- **Encrypted DNS-over-TLS**: When `DOT=on`, Unbound runs locally, listening on `127.0.0.1:53`, encrypting all DNS queries via TLS to Cloudflare, Quad9, or custom upstream providers.
- **DNS Blocking**: Local malicious and advertising domain blacklists are loaded into Unbound.
- **Leak Protection**: In `internal/vpn/tunnelup.go`, the firewall explicitly blocks any outbound DNS traffic (UDP/TCP port 53) from bypassing the encrypted resolver.
