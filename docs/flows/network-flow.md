# Network Flow

```mermaid
flowchart LR
  App --> Namespace[Shared Gluetun namespace] --> Tunnel --> Provider --> Internet
  Internet --> ProtonPort[Proton forwarded port] --> Gluetun --> Caddy --> App
  Browser --> Dashboard -->|bridge :8000| Gluetun
  Dashboard -->|Unix socket| Caddy
```

`caddy` and `routed-app` use `network_mode: service:gluetun`; dashboard is a
separate unprivileged bridge container. Proton NAT-PMP requests TCP/UDP leases
for 60 seconds and renews them after 45 seconds. Compose forwards Gluetun's
assigned port to its stable namespace-local listener `:8080`. **VERIFIED**;
real external Proton/DNS reachability was not exercised.
