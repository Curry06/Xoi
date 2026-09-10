# Request Flow

```text
Browser → dashboard middleware → APIHandler → coordinator/client/store/manager
→ JSON response or SSE snapshot → browser state and render
```

`GET /status` returns the coordinator's cached snapshot. Coordinator polling
calls Gluetun `/v1/*` every 2.5 seconds and broadcasts SSE `status` events.
VPN mutations obtain `TryLockOperation`, call the typed native API client, then
refresh/broadcast state. Proxy mutation validates a route, dynamically loads the
complete candidate set into Caddy, persists JSON only after success, and probes
the route through Caddy ingress. **VERIFIED**.
