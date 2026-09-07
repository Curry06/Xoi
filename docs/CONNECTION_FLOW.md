# Gluetun Control Center: Connection Lifecycle Execution Flows

This document details the exact execution call paths for connection state transitions, including Connect, Disconnect, Reconnect, Server Switching, and Port Forwarding.

---

## 1. Connect Execution Flow

Traced from user interaction through the frontend, API, engine control server, and kernel networking stack:

```text
[VERIFIED CURRENT]
1. User clicks "Connect" in OverviewPage.tsx
   │
   ▼
2. apiClient.vpnConnect() (web/src/api/client.ts)
   │  Sends HTTP POST /api/dashboard/vpn/connect
   │  Headers: X-CSRF-Token, Cookie: gluetun_session_id
   ▼
3. APIHandler.handleVPNConnect() (internal/dashboard/api/handlers.go)
   │  Validates CSRF token & user session
   │  Calls coordinator.Connect(ctx)
   ▼
4. Coordinator.Connect(ctx) (internal/dashboard/state/coordinator.go)
   │  Acquires c.mu.Lock() (sets c.operationInProgress = true)
   │  Sets transient state: c.snapshot.State = "connecting"
   │  Broadcasts update via SSE
   │  Calls c.client.SetVPNStatus(ctx, "running")
   ▼
5. RealClient.SetVPNStatus(ctx, "running") (internal/dashboard/gluetun/client.go)
   │  Sends HTTP PUT /v1/vpn/status with body {"status": "running"}
   ▼
6. vpnHandler.setStatus() (internal/server/vpn.go)
   │  Decodes payload statusWrapper{"status": "running"}
   │  Calls h.looper.ApplyStatus(h.ctx, constants.Running)
   ▼
7. Loop.ApplyStatus() (internal/loopstate/state.go & internal/vpn/loop.go)
   │  Transitions statusManager from Stopped -> Starting
   │  Sends struct{}{} across l.start channel
   ▼
8. Loop.Run() goroutine receives on l.start (internal/vpn/run.go)
   │  Loads active settings: settings := l.state.GetSettings()
   │  Resolves provider: providerConf := l.providers.Get(...)
   │
   ├── For WireGuard:
   │   Calls setupWireguard() (internal/vpn/wireguard.go)
   │   Creates WireGuard runner, connects link via netlink, sets up routes & firewall
   │
   ├── For OpenVPN:
   │   Calls setupOpenVPN() (internal/vpn/openvpn.go)
   │   Creates OpenVPN runner, generates client config, sets up TUN, routes & firewall
   │
   ▼
9. vpnRunner.Run(vpnCtx, waitError, tunnelReady) (goroutine)
   │  Establishes network tunnel
   │  On successful handshake: closes tunnelReady channel
   ▼
10. Loop.Run() receives on <-tunnelReady
   │  Launches: go l.onTunnelUp(vpnCtx, ctx, tunnelUpData) (internal/vpn/tunnelup.go)
   │  Sub-steps in onTunnelUp:
   │    a. Opens firewall for VPN input ports: l.fw.SetAllowedPort(...)
   │    b. Path MTU Discovery: updateToMaxMTU(...)
   │    c. Starts encrypted DNS: l.dnsLooper.ApplyStatus(ctx, constants.Running)
   │    d. Starts health checker: l.healthChecker.Start(ctx)
   │    e. Fetches public IP: l.publicip.RunOnce(ctx)
   │    f. Starts port forwarding: l.startPortForwarding(data)
   │       └── l.portForward.UpdateWith(partialUpdate)
   ▼
11. Loop.signalOrSetStatus(constants.Running)
   │  Engine status is officially "running"
   ▼
12. Coordinator polls engine / receives status
   │  Updates snapshot state: "connected"
   │  Updates public IP and forwarded port
   │  Releases c.mu.Unlock() (c.operationInProgress = false)
   │  Broadcasts "connected" snapshot to browser via SSE
```

---

## 2. Disconnect Execution Flow

Traced from user confirmation to complete network teardown:

```text
[VERIFIED CURRENT]
1. User clicks "Disconnect" in OverviewPage.tsx
   │  Confirmation modal appears
   │  User confirms disconnect
   ▼
2. apiClient.vpnDisconnect() (web/src/api/client.ts)
   │  Sends HTTP POST /api/dashboard/vpn/disconnect
   ▼
3. APIHandler.handleVPNDisconnect() (internal/dashboard/api/handlers.go)
   │  Calls coordinator.Disconnect(ctx)
   ▼
4. Coordinator.Disconnect(ctx) (internal/dashboard/state/coordinator.go)
   │  Acquires c.mu.Lock() (locks other state operations)
   │  Sets transient state: c.snapshot.State = "disconnecting"
   │  Broadcasts update via SSE
   │  Calls c.client.SetVPNStatus(ctx, "stopped")
   ▼
5. RealClient.SetVPNStatus(ctx, "stopped") (internal/dashboard/gluetun/client.go)
   │  Sends HTTP PUT /v1/vpn/status {"status": "stopped"}
   ▼
6. vpnHandler.setStatus() (internal/server/vpn.go)
   │  Calls h.looper.ApplyStatus(h.ctx, constants.Stopped)
   ▼
7. Loop.ApplyStatus() (internal/loopstate/state.go)
   │  Sends struct{}{} across l.stop channel
   ▼
8. Loop.Run() receives on <-l.stop (internal/vpn/run.go)
   │  Executes ordered teardown:
   │    a. l.cleanup():
   │       - Stops health checker: l.healthChecker.Stop()
   │       - Stops port forwarding: l.stopPortForwarding() -> cleans firewall allowances
   │       - Stops public IP loop: l.publicip.Stop()
   │    b. vpnCancel(): Cancels context for vpnRunner
   │    c. Runner shuts down WireGuard interface or kills OpenVPN process
   │    d. Waiting on <-waitError confirms tunnel process terminated
   │    e. Sends confirmation across l.stopped <- struct{}{}
   ▼
9. Status changes to "stopped"
   │  Firewall kill switch remains active (blocking all un-tunneled outbound traffic)
   ▼
10. Coordinator records disconnect in audit history
   │  Updates snapshot state: "disconnected"
   │  Releases c.mu.Unlock()
   │  Pushes update to UI via SSE
```

---

## 3. Reconnect Execution Flow

Reconnection occurs under two distinct scenarios:

### Scenario A: User-Initiated Reconnect
```text
[VERIFIED CURRENT]
1. User requests Reconnect from OverviewPage
2. Coordinator.Reconnect(ctx) acquires lock
3. Executes sequential Disconnect -> Connect
4. Resets uptime counters and records reconnect event in history store
```

### Scenario B: Auto-Healing on Health Check Failure
```text
[VERIFIED CURRENT]
1. Health checker loop (internal/vpn/tunnelup.go: collectHealthErrors) receives healthErr
2. Checks if *l.healthSettings.RestartVPN == true
3. Calls l.restartVPN(loopCtx, healthErr) in background goroutine:
   - l.ApplyStatus(ctx, constants.Stopped)
   - l.ApplyStatus(ctx, constants.Running)
4. Reconnection count increments, and Coordinator detects new state during periodic poll
```

---

## 4. NAT-PMP Port Forwarding Flow

For providers supporting port forwarding (e.g. ProtonVPN, PIA):

```text
[VERIFIED CURRENT]
1. Tunnel Up triggers startPortForwarding() (internal/vpn/tunnelup.go)
   │
   ▼
2. Loop.UpdateWith(partialUpdate) (internal/portforward/loop.go)
   │  Sets VPNIsUp = true
   │  Calls service.New(...) and service.Start(runCtx)
   ▼
3. Service.Start() (internal/portforward/service/start.go)
   │  Obtains gateway IP via s.routing.VPNLocalGatewayIP(s.settings.Interface)
   │  Obtains assigned IP via s.routing.AssignedIP(...)
   │  Calls s.settings.PortForwarder.PortForward(ctx, obj)
   │  (Runs provider-specific NAT-PMP / PCP protocol request)
   ▼
4. Port Forwarder returns external assigned port (e.g. 45220)
   │
   ▼
5. Service.onNewPorts() (internal/portforward/service/start.go)
   │  a. Firewall rule: s.portAllower.SetAllowedPort(ctx, port, vpnInterface)
   │  b. IPTables DNAT redirect (if listening port differs from internal port):
   │     s.portAllower.RedirectPort(ctx, vpnInterface, internalPort, destPort)
   │  c. Writes port to disk: s.writePortForwardedFile(...) (default: /gluetun/forwarded_port)
   │  d. Stores in memory: s.ports = []uint16{45220}
   │  e. Executes user UpCommand if configured
   ▼
6. KeepPortForward Background Goroutine (internal/portforward/service/start.go)
   │  Runs s.settings.PortForwarder.KeepPortForward(ctx, obj)
   │  Continuously refreshes NAT-PMP lease (default ~45-60s interval)
   │  If renewal fails, signals runErrorCh and attempts automatic re-lease
   ▼
7. Dashboard Detection:
   │  Coordinator polls GET /v1/portforward
   │  Validates port > 0 && port <= 65535 (never displays port 0)
   │  Logs port allocation event in /data/history.json
   │  Pushes port details and QR code payload to browser via SSE
```
