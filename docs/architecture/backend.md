# Backend Architecture

## Dashboard startup

`run` in `cmd/gluetun-dashboard/main.go` reads environment variables, creates
a real or mock engine client, opens history/profile/proxy JSON stores, creates
the proxy manager and coordinator, starts their polling/reconciliation loops,
creates the authenticator, then mounts API routes below `/api/` and the SPA at
`/`.

The implementation is a modular Go monolith, not MVC or microservices:

```text
HTTP handler → APIHandler → Coordinator / Gluetun client / Store / Proxy manager
```

## State coordinator

`Coordinator.Refresh` obtains version, VPN status, DNS/updater status, VPN
settings, public IP, and forwarded port. It derives `LiveSnapshot`, broadcasts
SSE, records selected history events, triggers deduplicated Telegram notices,
and updates proxy endpoint state. `TryLockOperation` serializes conflicting
VPN controls. Engine failures mark the endpoint `vpn_offline` but retain JSON
routes and profiles.

## Native API adapter

`dashboard/gluetun.RealClient` uses a 10-second shared HTTP client and calls
`/v1/version`, VPN/DNS/updater status/settings, `/v1/publicip/ip`, and
`/v1/portforward`. It is the dashboard's sole path to the engine.

## Failure and shutdown

Caddy config failure prevents store replacement and is recorded as a proxy
reload error. Dashboard restart loses sessions/snapshots but reloads JSON data.
Dashboard reacts to cancellation with `http.Server.Shutdown`; Gluetun orders
its own loop shutdown with `goshutdown`.
