# Component Architecture

## Gluetun engine

| Module | Role | Consumers |
| --- | --- | --- |
| `internal/configuration` | Merges secrets/files/environment into validated settings. | `cmd/gluetun` |
| `internal/vpn` | Starts and restarts OpenVPN, WireGuard, or AmneziaWG. | native API, DNS, forwarding |
| `internal/provider` | Provider-specific connection/server data; Proton implements NAT-PMP. | VPN loop, updater |
| `internal/firewall`, `routing`, `netlink`, `tun` | Linux kill-switch, policy routing, interfaces. | VPN loop only |
| `dns`, `publicip`, `portforward`, `healthcheck`, `updater` | Long-running support loops. | engine and native API |
| `internal/server` | Versioned native HTTP API with independent auth middleware. | dashboard, compatible clients |

## Dashboard

| Module | Role | State/output |
| --- | --- | --- |
| `dashboard/api` | HTTP handlers, middleware, SSE endpoints. | JSON responses |
| `dashboard/gluetun` | Typed native API adapter or mock client. | `LiveSnapshot` inputs |
| `dashboard/state` | 2.5-second poll, derived state, SSE broadcast, operation lock. | in-memory snapshot |
| `dashboard/history`, `profiles` | Mutex-protected JSON stores. | `/data/*.json` |
| `dashboard/auth` | Single-user sessions, CSRF, rate limiting. | in-memory sessions |
| `dashboard/notify` | Telegram endpoint-change messages. | external Bot API |
| `dashboard/web` | Embedded static SPA handler with index fallback. | browser assets |

## Proxy manager

`Manager` normalizes and validates a route, detects route/target collisions,
loads the whole candidate set into Caddy, then persists the complete JSON set.
If persistence fails, it attempts to restore Caddy's prior set. A 15-second
reconciliation loop reloads persisted valid routes after Caddy restart.

`CaddyProvider` is the current `ProxyProvider` implementation. It performs
dynamic `POST /load`; `ProxyProvider` leaves room for other engines later.
