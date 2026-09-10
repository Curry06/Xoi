# API Reference

Dashboard routes are under `/api/dashboard`. Login, bootstrap, status, and SSE
are public to dashboard middleware; other routes require a session when auth is
enabled, and mutations require `X-CSRF-Token`. Errors use the API error envelope.

| Methods | Endpoint family | Handler responsibility |
| --- | --- | --- |
| `POST` | `/auth/login`, `/auth/logout` | In-memory session lifecycle. |
| `GET` | `/bootstrap`, `/status`, `/events/stream` | Snapshot and SSE state. |
| `GET` | `/capabilities`, `/servers`, `/traffic`, `/history` | Dashboard/engine data. |
| `POST`/`PUT` | `/vpn/*`, `/profiles/*` | Serialized engine/profile control. |
| `GET`/`POST` | `/proxy/routes`, `/proxy/status`, `/public-endpoint` | Proxy routes and endpoint state. |
| `GET`/`PUT`/`DELETE` | `/proxy/routes/{id}` | Route lifecycle. |
| `POST` | `/proxy/routes/test-target`, `/{id}/enable`, `/{id}/disable` | Probe and toggle operations. |

Native Gluetun API routes are rooted at `/v1`: version, VPN, OpenVPN, DNS,
updater, public-IP, and port-forward handlers. The definitive native method
allowlist is `internal/server/middlewares/auth/settings.go`. **VERIFIED**.
