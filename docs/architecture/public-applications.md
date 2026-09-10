# Public Applications: Verified Integration Audit and Design

This document records the repository state verified on 2026-09-10 before
extending the public-application feature. It is intentionally based on source
code and the Compose topology rather than package names or intended diagrams.

## Current Architecture

The system has two binaries with separate privilege boundaries:

1. `cmd/gluetun` is the privileged data-plane engine. It owns the VPN tunnel,
   firewall, routing, public IP lookup, and Proton port-forward lease.
2. `cmd/gluetun-dashboard` is the unprivileged control plane. It serves the
   embedded React dashboard on port `9090` and talks to Gluetun's internal
   control API on port `8000` over the `vpn-management` bridge network.

The existing port-forward service is the source of truth for the public
endpoint. Once a VPN tunnel is up, it obtains and renews the provider lease,
allows the assigned input port through the firewall, and redirects that dynamic
port to the fixed `VPN_PORT_FORWARDING_LISTENING_PORTS` destination. The
dashboard polls `/v1/publicip/ip` and `/v1/portforward`, then publishes the
combined endpoint through the state coordinator.

For this deployment, the fixed destination is port `8080`. Therefore a Proton
port change does **not** require a Caddy reload or route update:

```text
Proton public-IP:dynamic-port
  -> Gluetun firewall allow rule
  -> Gluetun DNAT to namespace-local :8080
  -> one Caddy listener
  -> route-selected application on 127.0.0.1:unique-port
```

`caddy` and each exposed application use `network_mode: "service:gluetun"`,
which gives them the same loopback, `eth0`, VPN interface, routing table, and
firewall as Gluetun. The dashboard remains outside that namespace. Databases,
Redis, and other management services must remain on a separate private network.

## Existing Feature State

The in-progress implementation already provides the following:

- `internal/proxy` contains a route model, JSON route store, Caddy provider,
  health probe, metrics registry, validation, and CRUD manager.
- `cmd/gluetun-dashboard/main.go` creates the proxy manager, starts it,
  connects endpoint updates from the coordinator, and attaches it to the API.
- `internal/dashboard/api` exposes authenticated dashboard-pattern endpoints
  under `/api/dashboard/proxy/*` and `/api/dashboard/public-endpoint`.
- `web/src/pages/PublicApplicationsPage.tsx` and its proxy components provide
  route list, create, edit, probe, enable/disable, deletion confirmation, and
  route-detail UI.
- `docker-compose.dashboard.yml` declares exactly one Caddy container in the
  Gluetun namespace and routes the provider's dynamic port to `8080`.

Route configuration is persisted in `/data/proxy_routes.json`, consistent with
the existing profile and history stores. The public IP and forwarded port are
runtime state only and are not stored in individual routes.

## Initial Implementation Boundaries

The existing implementation is not yet production-complete. The following
observations are verified from the current source and Compose file.

1. Caddy's admin control channel is a permissioned Unix socket mounted only by
   Caddy and the dashboard. It is not bound to a TCP interface, published on
   the host, or visible to application containers.
2. `protocol: https` configures the Caddy-to-upstream transport. Caddy handles
   WebSocket upgrades through `reverse_proxy`. Public TLS termination remains
   disabled until certificate provisioning is configured.
3. A Proton random forwarded port cannot obtain a publicly trusted Caddy
   certificate using HTTP-01 or TLS-ALPN-01 because certificate authorities
   require ports 80 or 443. Public TLS needs a later DNS-01 or supplied
   certificate capability. Until one is configured, the API must reject public
   TLS rather than claim it is enabled.
4. Manager mutations apply a complete candidate route set to Caddy before
   atomically persisting it. Persistence failure triggers a Caddy rollback; IDs
   are generated before the candidate set is applied.
5. Startup and periodic reconciliation load persisted routes after Caddy starts
   or restarts without restarting Gluetun or applications.
6. Target probes apply the same target policy as route mutations.
7. The default target policy is loopback-only (`127.0.0.1`, `::1`, and
   `localhost`). Environment-configured host allowlists and denylists can extend
   the policy, while management/database/Docker ports and link-local metadata
   addresses remain blocked.
8. Route health probes traverse Caddy's private ingress URL, so the probe uses
   the same Caddy-to-upstream network namespace path as external traffic.
   Per-route traffic metrics are an in-memory placeholder: Caddy does not feed
   request, byte, status, or connection data to the registry.
9. Runtime route states account for VPN and public-endpoint availability. A
   healthy target can still report `VPN_OFFLINE` or
   `PUBLIC_ENDPOINT_UNAVAILABLE` when ingress is unavailable.
10. Route ordering is deterministic: domain routes precede path routes and
    longer path prefixes precede shorter ones. Overlapping path prefixes are
    rejected.

## Design Decisions

The implementation keeps Gluetun responsible for all packet forwarding and
lease management. No `protonendpoint` package is required: the existing
Gluetun control API plus the dashboard coordinator already provide a clean
endpoint observation boundary. The proxy manager receives endpoint snapshots,
not NAT-PMP credentials or tunnel handles.

The first supported data-plane contract is HTTP reverse proxying on the fixed
local ingress port. Domain routing is preferred. Path routing is supported with
an explicit UI warning because application-generated absolute paths can break.
HTTPS upstreams and WebSockets can be represented by transport settings when
implemented. Public TLS termination remains disabled unless certificate
provisioning is explicitly configured.

The manager will use an atomic desired-state transition:

```text
validate candidate -> build complete desired route set -> apply Caddy config
  -> persist the same route set atomically -> publish runtime result
```

If Caddy rejects the candidate configuration, persisted routes remain unchanged.
If persistence fails after Caddy accepts, the manager immediately restores the
previous complete Caddy configuration and reports the rollback failure if one
occurs. A periodic reconciliation loop reloads the persisted desired state after
Caddy restarts without restarting Gluetun, applications, or the dashboard.

## Planned Files

The next implementation pass is deliberately limited to these files:

| Area | Files | Change |
| --- | --- | --- |
| Route safety and atomicity | `internal/proxy/models.go`, `interfaces.go`, `store.go`, `manager.go`, `validator.go` | Add target-policy settings, deterministic route sets, consistent probe validation, endpoint-aware runtime state, and transactional reconciliation. |
| Caddy integration | `internal/proxy/caddy.go`, `internal/proxy/caddy_test.go` | Bootstrap/load a private admin endpoint, keep deterministic route order, configure supported upstream transport behavior, and restore prior config on failure. |
| Runtime status and logs | `internal/proxy/health.go`, `metrics.go`, new focused tests | Separate endpoint/proxy/upstream health and define an export-ready metrics collector boundary. |
| Dashboard startup/API | `cmd/gluetun-dashboard/main.go`, `internal/dashboard/api/proxy_handlers.go`, `router.go`, handler tests | Pass proxy security settings, return structured status, validate probe requests, and enforce authenticated route mutations. |
| Namespace topology | `docker-compose.dashboard.yml`, new Caddy bootstrap config and Compose documentation | Remove the unnecessary host ingress publish, start Caddy with a deterministic private admin configuration, and keep only proxy/apps in Gluetun's namespace. |
| Dashboard UI | `web/src/pages/PublicApplicationsPage.tsx`, `web/src/components/proxy/*`, `web/src/api/client.ts`, `web/src/types/index.ts`, frontend tests | Show actual runtime state, accurate TLS limits, fixed internal ingress, health, endpoint changes, and metric availability. |
| Documentation | `docs/README.md`, `docs/architecture/docker.md`, `docs/architecture/database.md`, this file | Keep the topology, persistence model, and supported capability matrix accurate. |

No changes are proposed to `internal/vpn`, `internal/wireguard`,
`internal/openvpn`, `internal/firewall`, `internal/routing`, `internal/natpmp`,
or Gluetun's port-forward implementation. The feature reuses their existing,
tested lifecycle and only consumes their published state.

## Verification Plan

Automated tests will cover route validation, atomic provider/store rollback,
route conflict ordering, Caddy restart reconciliation, endpoint changes,
disabled routes, target outage/recovery, and authenticated API mutations.

The Compose integration test requires a real Proton account and a DNS name. It
will verify one, five, and twenty routes; a VPN reconnect; port reallocation;
Caddy restart; app restart; HTTP and WebSocket requests. Public TLS is excluded
until DNS-01 or supplied-certificate support is added.
