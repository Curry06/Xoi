# Configuration Reference

Configuration sources are secret files, Gluetun configuration files,
environment variables, Compose `.env` interpolation, and dashboard JSON stores.
Never document or commit real `.env` or secret-file values.

| Variable group | Component | Purpose |
| --- | --- | --- |
| `DASHBOARD_HTTP_*`, `DASHBOARD_AUTH_*`, `DASHBOARD_DATA_DIR` | Dashboard | Listener, single-user auth, JSON persistence. |
| `GLUETUN_CONTROL_*`, `GLUETUN_MOCK` | Dashboard | Native API adapter or mock mode. |
| `CADDY_*`, `DASHBOARD_PROXY_*` | Dashboard/proxy | Private admin socket, health ingress, target policy. |
| `TELEGRAM_*` | Dashboard | Optional Bot API notices. |
| `VPN_*`, `OPENVPN_*`, `WIREGUARD_*` | Gluetun | Provider/tunnel/credentials. |
| `FIREWALL_*`, `DNS_*`, `PUBLICIP_*`, `VPN_PORT_FORWARDING_*` | Gluetun | Networking, DNS, exit IP, forwarding. |

`internal/configuration/settings.Settings` owns the complete engine setting
groups and merges sources in `cmd/gluetun/main.go`. `.env.example` is the safe
operator template. **VERIFIED**.
