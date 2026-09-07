# Gluetun Control Center: Safe Management API Reference

The Gluetun Control Center exposes a sanitized, secure management API designed for dashboard frontend and automation integrations. It sits between the browser and the internal Gluetun VPN engine, enforcing authentication, CSRF protection, request validation, secret redaction, and concurrency locking.

The browser **never** connects directly to Gluetun engine port `8000`.

---

## Authentication & CSRF Protection

When authentication is enabled (`DASHBOARD_AUTH_REQUIRED=true`):

1. **Session Cookie**: Successful login via `POST /api/dashboard/auth/login` sets an `HttpOnly`, `SameSite=Lax` session cookie (`gluetun_session_id`).
2. **Bearer Token**: Alternatively, requests can supply `Authorization: Bearer <session_token>`.
3. **CSRF Protection**: All state-changing methods (`POST`, `PUT`, `DELETE`) require the `X-CSRF-Token` HTTP header matching the session's active CSRF token. The CSRF token is provided in the bootstrap response and login response.

---

## Standard Error Response Format

All error responses adhere to a consistent JSON schema:

```json
{
  "error": {
    "code": "VPN_OPERATION_FAILED",
    "message": "The VPN could not reconnect: timeout waiting for tunnel state.",
    "retryable": true,
    "request_id": "req-1741363200"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Session missing or expired. |
| `CSRF_INVALID` | 403 | Missing or invalid `X-CSRF-Token` header. |
| `OPERATION_IN_PROGRESS` | 409 | Another VPN state change is currently running. |
| `INVALID_ARGUMENT` | 400 | Request body or query parameters failed validation. |
| `NOT_FOUND` | 404 | Requested profile or resource does not exist. |
| `FEATURE_UNSUPPORTED` | 501 | Action is unsupported by the running Gluetun engine version. |
| `VPN_OPERATION_FAILED` | 502 / 500 | Engine returned an error during status transition. |

---

## Endpoint Catalog

### 1. System & Bootstrap

#### `GET /api/dashboard/bootstrap`
Returns comprehensive initial application state in a single roundtrip to minimize startup latency.

* **Response**:
```json
{
  "session": {
    "authenticated": true,
    "username": "admin",
    "csrf_token": "a8f9c2..."
  },
  "snapshot": { ... },
  "capabilities": { ... },
  "profiles": [ ... ],
  "history": [ ... ]
}
```

#### `GET /api/dashboard/status`
Returns real-time tunnel status, public IP, port forward allocation, DNS status, and system metrics.

* **Response**:
```json
{
  "state": "connected",
  "engine_online": true,
  "engine_version": "v3.39.1",
  "dashboard_version": "1.0.0",
  "is_mock": false,
  "provider": "protonvpn",
  "protocol": "wireguard",
  "country": "India",
  "city": "Mumbai",
  "public_ip": {
    "public_ip": "185.159.157.10",
    "city": "Mumbai",
    "country": "India",
    "organization": "Proton AG"
  },
  "tunnel_interface": "tun0",
  "uptime_seconds": 3840,
  "reconnection_count": 0,
  "dns_status": "running",
  "updater_status": "stopped",
  "port_forwarding": {
    "available": true,
    "port": 45220,
    "internal_port": 8080,
    "public_ip": "185.159.157.10",
    "full_endpoint": "185.159.157.10:45220",
    "status": "active"
  },
  "traffic": {
    "available": true,
    "download_rate": 1420500,
    "upload_rate": 284000,
    "total_download": 482910200,
    "total_upload": 89201900
  },
  "capabilities": { ... },
  "operation_in_progress": false,
  "last_updated": "2026-09-07T21:40:00Z"
}
```

#### `GET /api/dashboard/capabilities`
Returns feature flags supported by the current Gluetun engine. The frontend uses this to conditionally enable or disable UI buttons.

* **Response**:
```json
{
  "can_connect": true,
  "can_disconnect": true,
  "can_reconnect": true,
  "can_switch_server_runtime": true,
  "can_change_protocol_runtime": false,
  "can_control_dns_runtime": true,
  "can_read_port_forwarding": true,
  "can_read_traffic": true,
  "can_control_firewall": false,
  "can_read_version": true,
  "can_read_public_ip": true,
  "can_read_updater_status": true,
  "can_control_updater_runtime": true
}
```

---

### 2. VPN Tunnel Operations

#### `POST /api/dashboard/vpn/connect`
Commands Gluetun engine to start the VPN tunnel (`PUT /v1/vpn/status {"status": "running"}`).

#### `POST /api/dashboard/vpn/disconnect`
Commands Gluetun engine to stop the VPN tunnel (`PUT /v1/vpn/status {"status": "stopped"}`). Enforces confirmation modal on the frontend.

#### `POST /api/dashboard/vpn/reconnect`
Restarts the active VPN connection safely.

#### `PUT /api/dashboard/vpn/selection`
Updates server selection at runtime using `PUT /v1/vpn/settings` with automatic rollback if the switch fails.

* **Request Body**:
```json
{
  "provider": "protonvpn",
  "country": "India",
  "city": "Mumbai",
  "server_name": "IN#5"
}
```

---

### 3. Server Explorer & Port Forwarding

#### `GET /api/dashboard/servers?provider=protonvpn&country=India`
Queries Gluetun's built-in server database with optional filtering by country, city, and protocol.

#### `GET /api/dashboard/port-forwarding`
Returns port forwarding details, assigned dynamic port, internal redirect port, and QR code payload. Never displays port `0` as active.

#### `POST /api/dashboard/endpoint/test`
Runs an external health probe against the public forwarded port to test reachability.

---

### 4. Profiles Management

* `GET /api/dashboard/profiles`: List all saved profiles.
* `POST /api/dashboard/profiles`: Create a new profile.
* `PUT /api/dashboard/profiles/{id}`: Update an existing profile.
* `DELETE /api/dashboard/profiles/{id}`: Delete a profile.
* `POST /api/dashboard/profiles/{id}/apply`: Apply profile configuration to the active tunnel.

**Security Rule**: Profile JSON must never store private keys, passwords, or authentication secrets.

---

### 5. Diagnostics, Audit & SSE Stream

#### `GET /api/dashboard/history`
Retrieves audit events, IP changes, and port updates.

#### `GET /api/dashboard/history/export`
Exports a sanitized diagnostic JSON log with passwords and tokens redacted.

#### `GET /api/dashboard/events/stream`
Server-Sent Events (SSE) live push stream broadcasting state changes immediately as they occur.
