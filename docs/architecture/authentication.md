# Authentication and Authorization

## Dashboard

`Authenticator` supports one configured username/password. It stores a
SHA-256 password hash in memory and creates random bearer session and CSRF
tokens. Sessions are in-memory, expire after 24 hours, and vanish on restart.

```text
Login → credential comparison → session plus CSRF token → protected request
→ bearer header or cookie → CSRF header for state mutation
```

Login is rate limited to 5 requests/second with burst 10 by client IP. There
is no role model, OAuth/OIDC, persistent session store, or multi-user support.
Login, bootstrap, status, and SSE are not blocked by dashboard auth middleware;
other dashboard API routes require a valid session when auth is enabled.

## Native API

Gluetun has independent role-based auth middleware with none/basic/API-key
methods sourced from an optional auth file and default role JSON. Compose keeps
that API private on the Docker bridge, while dashboard can send an optional API
key. Caddy admin access is a separate Unix-socket trust boundary.
