# Data and Persistence

## No database server

**VERIFIED** — There is no SQL database, Redis, ORM, schema migration, or
database connection code. Dashboard persistence is filesystem JSON.

| File under `DASHBOARD_DATA_DIR` | Owner | Purpose |
| --- | --- | --- |
| `history.json` | history store | Capped audit/operational events; messages and metadata are redacted before write. |
| `profiles.json` | profile store | User-defined VPN selection profiles. |
| `proxy_routes.json` | proxy store | Route configuration and last health status. |

The stores use mutex-protected in-memory state and atomic file replacement.
Proxy `Store.Replace` persists a complete candidate set before swapping its map,
which supports Caddy rollback on failed route persistence.

Public endpoint data is runtime-only: it comes from Gluetun's public-IP and
port-forward state and is never persisted into route records.
