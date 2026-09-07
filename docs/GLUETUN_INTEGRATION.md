# Gluetun Integration Boundary Specification

This document maps the exact boundaries where custom application code interfaces with the Gluetun VPN engine.

---

## 1. The Primary Integration Interface (`Client`)

The integration between the dashboard application and the Gluetun engine is abstracted through a Go interface defined in [`internal/dashboard/gluetun/interface.go`](file:///home/vedx/Videos/Gul/internal/dashboard/gluetun/interface.go):

```go
// [VERIFIED CURRENT]
type Client interface {
    GetVersion(ctx context.Context) (info models.BuildInformation, err error)
    GetVPNStatus(ctx context.Context) (status string, err error)
    SetVPNStatus(ctx context.Context, status string) (err error)
    GetVPNSettings(ctx context.Context) (vpnSettings settings.VPN, err error)
    SetVPNSettings(ctx context.Context, vpnSettings settings.VPN) (err error)
    GetPublicIP(ctx context.Context) (ip models.PublicIP, err error)
    GetPortForwarded(ctx context.Context) (port uint16, err error)
    GetDNSStatus(ctx context.Context) (status string, err error)
    SetDNSStatus(ctx context.Context, status string) (err error)
    GetUpdaterStatus(ctx context.Context) (status string, err error)
    SetUpdaterStatus(ctx context.Context, status string) (err error)
}
```

Two concrete implementations fulfill this interface:
1. `RealClient` ([`internal/dashboard/gluetun/client.go`](file:///home/vedx/Videos/Gul/internal/dashboard/gluetun/client.go)): Communicates over HTTP with the running Gluetun control server.
2. `MockClient` ([`internal/dashboard/gluetun/mock.go`](file:///home/vedx/Videos/Gul/internal/dashboard/gluetun/mock.go)): Simulates 8 engine states without network side effects for standalone development and UI preview.

---

## 2. Engine Endpoints Invoked by Application

| Application Call | Engine HTTP Request | Engine Handler / Function | Payload / Return |
|---|---|---|---|
| `client.GetVersion(ctx)` | `GET /v1/version` | `handlerV1.getVersion` | Returns JSON `models.BuildInformation` (`version`, `commit`, `created`). |
| `client.GetVPNStatus(ctx)` | `GET /v1/vpn/status` | `vpnHandler.getStatus` | Calls `vpnLooper.GetStatus()` $\to$ returns `{"status": "running"\|"stopped"}`. |
| `client.SetVPNStatus(ctx, status)` | `PUT /v1/vpn/status` | `vpnHandler.setStatus` | Calls `vpnLooper.ApplyStatus(ctx, status)` $\to$ starts or stops VPN loop. |
| `client.GetVPNSettings(ctx)` | `GET /v1/vpn/settings` | `vpnHandler.getSettings` | Returns active `settings.VPN`. *(Scrubbed by dashboard redactor before presentation)*. |
| `client.SetVPNSettings(ctx, settings)` | `PUT /v1/vpn/settings` | `vpnHandler.patchSettings` | Updates settings in `vpnLooper` and restarts tunnel if needed. |
| `client.GetPublicIP(ctx)` | `GET /v1/publicip/ip` | `publicIPHandler.getPublicIP` | Returns JSON `models.PublicIP` (`public_ip`, `country`, `city`, `isp`, etc.). |
| `client.GetPortForwarded(ctx)` | `GET /v1/portforward` | `portForwardHandler.getPort` | Returns JSON `{"port": uint16, "ports": []uint16}` from `pf.GetPortsForwarded()`. |
| `client.GetDNSStatus(ctx)` | `GET /v1/dns/status` | `dnsHandler.getStatus` | Returns JSON `{"status": "running"\|"stopped"}` from `dnsLooper.GetStatus()`. |
| `client.SetDNSStatus(ctx, status)` | `PUT /v1/dns/status` | `dnsHandler.setStatus` | Restarts or stops the internal encrypted DNS resolver. |
| `client.GetUpdaterStatus(ctx)` | `GET /v1/updater/status` | `updaterHandler.getStatus` | Returns server updater loop status (`running` \| `stopped`). |
| `client.SetUpdaterStatus(ctx, status)` | `PUT /v1/updater/status` | `updaterHandler.setStatus` | Triggers a server list refresh. |

---

## 3. Direct Storage Integration: Server Database

In addition to HTTP endpoints, the dashboard directly shares access to Gluetun's embedded server database via [`internal/storage/servers.go`](file:///home/vedx/Videos/Gul/internal/storage/servers.go):

```go
// [VERIFIED CURRENT]
func (s *Storage) GetServers(provider string) (servers []models.Server) {
    if provider == providers.Custom {
        return nil
    }
    s.mergedMutex.RLock()
    defer s.mergedMutex.RUnlock()

    serversObject, ok := s.mergedServers.ProviderToServers[provider]
    if !ok {
        return nil
    }
    servers = make([]models.Server, len(serversObject.Servers))
    copy(servers, serversObject.Servers)
    return servers
}
```

This allows the dashboard to query thousands of ProtonVPN, Mullvad, and other provider servers with zero network overhead and strict thread-safety.

---

## 4. State Aggregation & Polling (`Coordinator`)

The application layer does not make separate ad-hoc HTTP calls from each frontend component. Instead, [`internal/dashboard/state/coordinator.go`](file:///home/vedx/Videos/Gul/internal/dashboard/state/coordinator.go) manages state synchronization:

1. **Background Polling Loop**: Periodically (default 2.5s) queries the Gluetun engine for VPN status, public IP, and port forwarding.
2. **Atomic Transitions**: Locks all mutating operations behind `coordinator.mu sync.Mutex`. Returns `409 Conflict` if an operation is already in progress.
3. **SSE Live Push**: Broadcasts state updates to connected clients across a Go channel (`eventsCh chan LiveSnapshot`).
4. **Traffic Rate Smoothing**: Computes real-time download and upload transfer rates and maintains rolling history buffers (1m, 15m, 1h).

---

## 5. Security & Isolation Boundaries

- **Control Port Isolation**: Port `8000` is exposed only on the private Docker bridge network `vpn-management`. It is never published on the host interface (`ports:`).
- **Loopback Binding**: The dashboard binds to `127.0.0.1:9090` by default.
- **Credential Redaction**: Before settings are returned to the API caller, all keys matching sensitive patterns (`private_key`, `password`, `secret`, `token`, `auth`) and base64 WireGuard key formats are sanitized by [`internal/dashboard/redaction/redact.go`](file:///home/vedx/Videos/Gul/internal/dashboard/redaction/redact.go).
