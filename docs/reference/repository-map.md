# Repository Map

```text
cmd/                     production entry points: Gluetun and dashboard
internal/configuration/  engine settings and source readers
internal/vpn/            tunnel lifecycle
internal/firewall/       kill-switch and iptables implementations
internal/routing/        netlink policy/default/local routing
internal/provider/       VPN-provider and updater implementations
internal/portforward/    forwarding service lifecycle
internal/natpmp/         NAT-PMP client used by Proton provider
internal/publicip/       resilient exit-IP lookup loop
internal/server/         native versioned control API
internal/dashboard/      dashboard API, auth, state, stores, SPA embed
internal/proxy/          provider abstraction, Caddy config, route persistence
web/                     React/Vite source and simulation UI
deploy/caddy/            initial Caddyfile
ci/, devrun/             non-production Go modules and tools
```

`internal/server/handlerv0.go` is legacy API compatibility. `web/dist` is a
development artifact; `internal/dashboard/web/dist` is embedded runtime data.
There are 176 Go test files and two frontend test files in this checkout.
