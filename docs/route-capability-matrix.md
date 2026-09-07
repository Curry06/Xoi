# Gluetun Control Center: Route & Capability Matrix

This matrix maps Gluetun's actual HTTP control server endpoints (verified against the current repository checkout) to the Control Center dashboard capabilities.

## Gluetun Engine Route Verification

| Gluetun Endpoint | HTTP Method | Supported in Engine | Engine Data / Behavior | Dashboard Capability & Mapping |
|---|---|---|---|---|
| `/version` | GET | Yes (Redirect) | 308 redirect to `/v1/version` | Normalized to `/v1/version` |
| `/v1/version` | GET | Yes | JSON `models.BuildInformation` (`version`, `commit`, `created`) | `can_read_version` → System Information |
| `/v1/vpn/status` | GET | Yes | JSON `{"status": "running"|"stopped"}` | `can_read_vpn_status` → Connection Hero state |
| `/v1/vpn/status` | PUT | Yes | Body `{"status": "running"|"stopped"}` → starts/stops VPN loop | `can_connect`, `can_disconnect` → Connect / Disconnect actions |
| `/v1/vpn/settings` | GET | Yes | Full `settings.VPN` (contains private keys, credentials) | **Internal only**. Sanitized & Redacted before exposing safe state |
| `/v1/vpn/settings` | PUT | Yes | Body `settings.VPN` (overrides, validates against storage, restarts VPN) | `can_switch_server_runtime` → Safe server selection & switching |
| `/v1/openvpn/status` | GET/PUT | Yes | JSON `{"status": "running"|"stopped"}` | Mirror / protocol-specific fallback |
| `/v1/openvpn/settings` | GET | Yes | JSON `settings.OpenVPN` (contains credentials) | Internal only; credentials never leaked |
| `/v1/dns/status` | GET | Yes | JSON `{"status": "running"|"stopped"}` | `can_read_dns_status` → DNS health badge |
| `/v1/dns/status` | PUT | Yes | Starts/stops internal DNS resolver loop | `can_control_dns_runtime` → Restart DNS action |
| `/v1/updater/status` | GET | Yes | JSON `{"status": "running"|"stopped"}` | `can_read_updater_status` → Server updater status |
| `/v1/updater/status` | PUT | Yes | Starts/stops server list updater loop | `can_control_updater_runtime` → Trigger server update |
| `/v1/publicip/ip` | GET | Yes | JSON `models.PublicIP` (`public_ip`, `country`, `city`, `region`, `hostname`, `org`...) | `can_read_public_ip` → Hero location & Public IP stats |
| `/v1/portforward` | GET | Yes | JSON `{"port": uint16, "ports": [uint16]}` | `can_read_port_forwarding` → Port Forwarding & Endpoint card |
| `/v1/portforward` | PUT | Yes | Sets forwarded ports in memory | Internal test helper; read-only for clients |
| `/v1/traffic` | - | **No** | Gluetun engine does not expose traffic telemetry | `can_read_traffic: false` (or host `/proc/net/dev` adapter) |
| `/v1/firewall` | - | **No** | Kill switch is an internal engine invariant | `can_control_firewall: false` (Displayed as "Active (Engine Invariant)") |
| `/v1/servers` | - | **No** | Engine server database is in embedded files/disk storage | Sourced directly via Dashboard's `storage.Storage` adapter |
| `/v1/profiles` | - | **No** | Not part of Gluetun engine | Handled natively by Dashboard storage |
| `/v1/history` | - | **No** | Not part of Gluetun engine | Handled natively by Dashboard storage & audit engine |

## Dashboard Safe Management API (`/api/dashboard/*`)

- `GET /api/dashboard/bootstrap`: Single roundtrip initial state (session, capabilities, status, active server, mock mode flag)
- `GET /api/dashboard/status`: Real-time VPN status, public IP, port forward, DNS status, uptime
- `GET /api/dashboard/capabilities`: Capability flags derived from engine version and runtime environment
- `GET /api/dashboard/servers`: Filtered server list (ProtonVPN & others) loaded from embedded storage
- `GET /api/dashboard/port-forwarding`: Assigned port (valid >0), internal redirect port, QR code data, history
- `GET /api/dashboard/traffic`: Current rates, historical series (1m, 15m, 1h), total counters
- `GET /api/dashboard/history`: Timeline of IP changes, port updates, reconnections, and user audit events
- `GET /api/dashboard/profiles`: Safe user profiles list
- `POST /api/dashboard/profiles`: Create profile
- `PUT /api/dashboard/profiles/{id}`: Edit profile
- `DELETE /api/dashboard/profiles/{id}`: Delete profile
- `POST /api/dashboard/profiles/{id}/apply`: Apply profile safely
- `POST /api/dashboard/vpn/connect`: Start VPN (sets status `running`)
- `POST /api/dashboard/vpn/disconnect`: Stop VPN (sets status `stopped`, requires confirmation)
- `POST /api/dashboard/vpn/reconnect`: Stop and re-start VPN (requires confirmation)
- `PUT /api/dashboard/vpn/selection`: Change server selection via `PUT /v1/vpn/settings` with rollback on failure
- `POST /api/dashboard/endpoint/test`: External reachability / health check on forwarded endpoint
- `GET /api/dashboard/events/stream`: Server-Sent Events (SSE) stream for live updates
