# Frontend Architecture

## Structure

**VERIFIED** — React 19 and TypeScript are built with Vite. `main.tsx` mounts
`App`; `App.tsx` selects pages with `history.pushState`; `DashboardLayout`
provides navigation. Vite outputs to `internal/dashboard/web/dist`, which Go
embeds through `internal/dashboard/web/embed.go`.

## Data flow

```text
React page → hook/APIClient → dashboard HTTP API → state/store/engine adapter
→ JSON or SSE → React state → render
```

`useLiveState` fetches status initially, subscribes to SSE `status` events,
falls back to five-second polling after stream errors, and marks data stale
after twelve seconds. `APIClient` uses same-origin credentials and attaches the
CSRF token to mutations after login.

## Simulation boundary

`useVPNState` starts from `services/simulationEngine.ts`; live data is blended
only after the user toggles live-engine mode. Thus traffic, devices, routing,
connections, firewall, and security visualizations can be simulated. Public
application route requests use the real dashboard proxy API, although their
metric counters have no live Caddy ingestion.

## Confirmed gap

The API client defines login/logout, but no React component calls `login`.
When authentication is enabled, public bootstrap/status/SSE work while
protected requests need a session established outside the current UI.
