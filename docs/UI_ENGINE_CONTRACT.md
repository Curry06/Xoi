# Gluetun Control Center: UI ↔ Engine Interface Contract

This specification establishes the strict boundary contract between the frontend browser UI, the Go dashboard API, and the Gluetun VPN engine.

---

## 1. Core Architectural Contract Principle

> **Strict Isolation Invariant**: The frontend browser client must **never** communicate directly with the kernel-level Gluetun engine (`:8000`), nor execute direct network commands (iptables, ip route, wg). All user interactions pass through the authenticated, sanitized management API (`:9090`).

```text
[Frontend Browser]
       │
       ▼ (Sanitized JSON & SSE Live Stream)
[Control Center Management API (:9090)]
       │
       ▼ (Internal HTTP Client)
[Gluetun Engine (:8000)]
```

---

## 2. Shared Data Models

### 2.1. `LiveSnapshot` (Current System State)
Broadcast over SSE (`/api/dashboard/events/stream`) and returned by `GET /api/dashboard/status`:

```typescript
// [VERIFIED CURRENT]
export interface LiveSnapshot {
  state: ConnectionState;          // 'unknown'|'disconnected'|'connecting'|'connected'|'reconnecting'|'disconnecting'|'degraded'|'error'
  engine_online: boolean;          // true if engine port 8000 responds
  engine_version: string;          // e.g. 'v3.39.1'
  dashboard_version: string;       // e.g. '1.0.0'
  is_mock: boolean;                // true if demo mode active
  provider: string;                // active provider, e.g. 'protonvpn'
  protocol: string;                // active protocol, e.g. 'wireguard'
  country?: string;
  city?: string;
  hostname?: string;
  public_ip: PublicIP;             // { public_ip, city, country, organization, ... }
  tunnel_interface: string;        // e.g. 'tun0'
  uptime_seconds: number;          // tunnel duration in seconds
  reconnection_count: number;
  dns_status: string;              // 'running' | 'stopped'
  updater_status: string;          // 'running' | 'stopped'
  port_forwarding: PortForwardingInfo; // { available, port, internal_port, status, ... }
  traffic: TrafficMetrics;         // { download_rate, upload_rate, total_download, total_upload, ... }
  capabilities: Capabilities;      // Feature enablement flags
  operation_in_progress: boolean;  // Mutex lock indicator
  last_updated: string;            // ISO 8601 timestamp
}
```

### 2.2. `Capabilities` (Dynamic Feature Flags)
Determines which UI buttons and actions are enabled or disabled:

```typescript
// [VERIFIED CURRENT]
export interface Capabilities {
  can_connect: boolean;
  can_disconnect: boolean;
  can_reconnect: boolean;
  can_switch_server_runtime: boolean;
  can_change_protocol_runtime: boolean; // false: changing protocol requires container restart
  can_control_dns_runtime: boolean;
  can_read_port_forwarding: boolean;
  can_read_traffic: boolean;
  can_control_firewall: boolean;       // false: kill-switch is an immutable engine invariant
  can_read_version: boolean;
  can_read_public_ip: boolean;
  can_read_updater_status: boolean;
  can_control_updater_runtime: boolean;
}
```

### 2.3. `Profile` (Non-Secret Connection Profile)
Persisted in `/data/profiles.json` and exportable as JSON:

```typescript
// [VERIFIED CURRENT]
export interface Profile {
  id: string;
  name: string;
  provider: string;
  country?: string;
  city?: string;
  hostname?: string;
  protocol: 'wireguard' | 'openvpn_udp' | 'openvpn_tcp' | string;
  port_forwarding: boolean;
  block_malicious: boolean;
  block_ads: boolean;
  block_surveillance: boolean;
  is_favorite: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}
```

> **Security Invariant**: `Profile` structs **must never** contain passwords, WireGuard private keys, API keys, or authentication tokens. All authentication credentials remain securely in server-side Docker secrets or environment variables.

---

## 3. State Model Transitions

```text
[VERIFIED CURRENT]
+-------------------------------------------------------------------------+
|                                                                         |
|                          ┌─────────────┐                                |
|                          │   UNKNOWN   │                                |
|                          └──────┬──────┘                                |
|                                 │                                       |
|                                 ▼                                       |
|                       ┌───────────────────┐                             |
|        ┌─────────────►│   DISCONNECTED    │◄─────────────┐              |
|        │              └─────────┬─────────┘              │              |
|        │ (Disconnect)           │ (Connect)              │              |
|        │                        ▼                        │              |
|  ┌─────────────┐      ┌───────────────────┐      ┌───────────────┐      |
|  │DISCONNECTING│      │    CONNECTING     │      │     ERROR     │      |
|  └─────────────┘      └─────────┬─────────┘      └───────▲───────┘      |
|        ▲                        │                        │              |
|        │                        ▼ (Tunnel Handshake OK)  │              |
|        │              ┌───────────────────┐              │              |
|        ├──────────────┤     CONNECTED     ├──────────────┤              |
|        │              └─────────┬─────────┘              │              |
|        │                        │ (Auto-heal / Switch)   │              |
|        │                        ▼                        │              |
|        │              ┌───────────────────┐              │              |
|        └──────────────┤   RECONNECTING    ├──────────────┘              |
|                       └───────────────────┘                             |
|                                                                         |
+-------------------------------------------------------------------------+
```

---

## 4. Operation Locking & Error Contract

### Concurrency Mutex
- When any state-modifying action (Connect, Disconnect, Reconnect, Server Selection) is triggered, `c.operationInProgress` is set to `true`.
- Any subsequent state-modifying requests receive HTTP status `409 Conflict`:
  ```json
  {
    "error": {
      "code": "OPERATION_IN_PROGRESS",
      "message": "Another VPN state change is currently running. Please wait.",
      "retryable": true
    }
  }
  ```

### Standard Error Schema
```json
{
  "error": {
    "code": "VPN_OPERATION_FAILED",
    "message": "Human-readable explanation of error.",
    "retryable": true,
    "request_id": "req-1741363200"
  }
}
```
