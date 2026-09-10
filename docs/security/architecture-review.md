# Architecture Security Review

## Confirmed protections

- Dashboard is non-root, read-only, capability-free, and host-bound to loopback.
- Native engine `:8000` is bridge-only; Caddy admin is a mode-`0600` Unix socket.
- Dashboard mutations use session/CSRF checks when auth is enabled; login is rate limited.
- Proxy validation defaults to loopback targets and reserves infrastructure ports.
- History messages/metadata are redacted before persistence.

## Confirmed issues

- The React application has no component that invokes the existing login API.
- Development credential defaults are unsafe for production if not overridden.
- Sessions are in-memory only and disappear on dashboard restart.

## Potential concerns

- Dashboard SSE state is public to dashboard auth middleware; keep host access private.
- Compose native API uses no auth on its bridge; do not attach untrusted containers.
- Do not configure wildcard CORS with cookie-authenticated public access.

## Verification needed

Real Proton forwarding, public DNS, external reachability, and host firewall
exposure were not exercised. Validate them before production deployment.
