# Shutdown Flow

Both production mains catch `SIGINT`/`SIGTERM`, cancel a root context, and use
bounded shutdown. Dashboard calls `http.Server.Shutdown` with four seconds.
Gluetun stops forwarding/public-IP/SOCKS/metrics and uses ordered `goshutdown`
groups for control, tickers, health, VPN, and other loops. Routing teardown is
deferred in the engine bootstrap path. Docker Compose stops Caddy separately;
JSON and named-volume data survives unless volumes are deleted. **VERIFIED**.
