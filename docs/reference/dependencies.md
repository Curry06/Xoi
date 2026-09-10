# Dependencies and External Systems

| Dependency | Why it exists | Failure behavior |
| --- | --- | --- |
| ProtonVPN and other providers | Tunnel/server configuration; Proton NAT-PMP forwarding. | VPN/lease state fails; routes persist. |
| Caddy 2.9 | One dynamically configured HTTP ingress. | Route mutation fails/reconciliation retries. |
| Docker/Compose | Local deployment topology. Dashboard does not call Docker socket. | Containers cannot start. |
| Public-IP APIs | Exit-IP lookup through Gluetun resilient fetcher. | Endpoint lacks a valid public IP. |
| Telegram Bot API | Optional endpoint notifications. | Does not block coordinator. |
| React/Vite/TypeScript | Embedded dashboard SPA. | Build/UI failure only. |
| Go networking libraries | Privileged engine networking. | Engine startup/tunnel failure. |
