# Deployment

## Prerequisites

Docker Engine with Compose, `/dev/net/tun`, permission to grant `NET_ADMIN`, a
ProtonVPN account/configuration that supports forwarding, and a host-local
dashboard access path are required. DNS and public TLS are separate concerns:
this checkout does not provision public certificates.

## Bring-up

1. Copy `.env.example` to a private `.env`; never commit it.
2. Set VPN credentials/keys and a strong dashboard password. Keep dashboard
   authentication enabled.
3. Build and start: `docker compose -f docker-compose.dashboard.yml up -d --build`.
4. Inspect `docker compose -f docker-compose.dashboard.yml ps` and dashboard,
   Gluetun, and Caddy logs.
5. Open `http://127.0.0.1:9090` through a local authenticated access method.
6. Add applications only after they share Gluetun's namespace and listen on
   unique non-reserved ports.

## Updates and recovery

Rebuild dashboard after source changes. Routes/profile/history persist through
the named dashboard volume. Caddy restart is recovered by the proxy manager's
reconciliation loop; VPN reconnect changes endpoint status without rewriting
routes. Back up the named volumes before destructive Compose removal.

## Production constraints

Do not expose Gluetun `:8000` or Caddy's admin socket. Do not use the example
dashboard password/defaults in production. Put dashboard access behind an
authenticated local/reverse-proxy boundary only after configuring allowed CORS
origins. Verify real external DNS, Proton forwarding, and app reachability as
an operational acceptance test.
