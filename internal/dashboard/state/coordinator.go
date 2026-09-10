package state

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/qdm12/gluetun/internal/constants"
	"github.com/qdm12/gluetun/internal/dashboard/gluetun"
	"github.com/qdm12/gluetun/internal/dashboard/history"
	"github.com/qdm12/gluetun/internal/dashboard/profiles"
	"github.com/qdm12/gluetun/internal/models"
	"github.com/qdm12/gluetun/internal/proxy"
)

type TelegramNotifier interface {
	IsEnabled() bool
	SendUpdate(ctx context.Context, publicIP, country string, port uint16) error
}

type ProxyEndpointUpdater interface {
	UpdatePublicEndpoint(endpoint proxy.PublicEndpoint)
}

type Coordinator struct {
	client           gluetun.Client
	historyStore     *history.Store
	profileStore     *profiles.Store
	trafficMonitor   *TrafficMonitor
	dashboardVersion string
	internalAppPort  uint16

	mutex               sync.RWMutex
	lastSnapshot        LiveSnapshot
	connectedSince      *time.Time
	reconnectionCount   uint32
	lastKnownIP         string
	lastKnownPort       uint16
	telegramNotifier    TelegramNotifier
	lastNotifiedIP      string
	lastNotifiedPort    uint16
	proxyUpdater        ProxyEndpointUpdater
	operationMutex      sync.Mutex
	operationInProgress bool
	currentOperation    string

	subscribersMutex sync.Mutex
	subscribers      map[chan LiveSnapshot]struct{}
}

func (c *Coordinator) SetTelegramNotifier(notifier TelegramNotifier) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.telegramNotifier = notifier
}

func (c *Coordinator) SetProxyUpdater(updater ProxyEndpointUpdater) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.proxyUpdater = updater
}

func NewCoordinator(
	client gluetun.Client,
	historyStore *history.Store,
	profileStore *profiles.Store,
	dashboardVersion string,
	internalAppPort uint16,
) *Coordinator {
	if internalAppPort == 0 {
		internalAppPort = 8080
	}

	trafficMon := NewTrafficMonitor("tun0", client.IsMock())

	coord := &Coordinator{
		client:           client,
		historyStore:     historyStore,
		profileStore:     profileStore,
		trafficMonitor:   trafficMon,
		dashboardVersion: dashboardVersion,
		internalAppPort:  internalAppPort,
		subscribers:      make(map[chan LiveSnapshot]struct{}),
		lastSnapshot: LiveSnapshot{
			DashboardVersion: dashboardVersion,
			IsMock:           client.IsMock(),
			Capabilities:     client.GetCapabilities(),
			State:            StateUnknown,
			LastUpdated:      time.Now(),
		},
	}

	return coord
}

func (c *Coordinator) Start(ctx context.Context, pollInterval time.Duration) {
	if pollInterval <= 0 {
		pollInterval = 2500 * time.Millisecond
	}

	// Immediate first refresh
	c.Refresh(ctx)

	go func() {
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				c.Refresh(ctx)
			}
		}
	}()
}

func (c *Coordinator) TryLockOperation(opName string) (func(), bool) {
	c.operationMutex.Lock()
	if c.operationInProgress {
		c.operationMutex.Unlock()
		return nil, false
	}

	c.operationInProgress = true
	c.currentOperation = opName
	c.operationMutex.Unlock()

	c.notifyStateChange()

	unlock := func() {
		c.operationMutex.Lock()
		c.operationInProgress = false
		c.currentOperation = ""
		c.operationMutex.Unlock()
		c.notifyStateChange()
	}

	return unlock, true
}

func (c *Coordinator) IsOperationInProgress() bool {
	c.operationMutex.Lock()
	defer c.operationMutex.Unlock()
	return c.operationInProgress
}

func (c *Coordinator) Refresh(ctx context.Context) LiveSnapshot {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	snapshot := LiveSnapshot{
		DashboardVersion:    c.dashboardVersion,
		IsMock:              c.client.IsMock(),
		Capabilities:        c.client.GetCapabilities(),
		OperationInProgress: c.IsOperationInProgress(),
		LastUpdated:         time.Now(),
	}

	if mockClient, ok := c.client.(*gluetun.MockClient); ok {
		snapshot.MockScenario = mockClient.GetScenario()
	}

	// 1. Check Version
	buildInfo, err := c.client.GetVersion(ctx)
	if err != nil {
		snapshot.EngineOnline = false
		snapshot.State = StateError
		c.updateProxyEndpoint(proxy.PublicEndpoint{Status: "vpn_offline"})
		c.lastSnapshot = snapshot
		c.broadcast(snapshot)
		return snapshot
	}
	snapshot.EngineOnline = true
	snapshot.EngineVersion = buildInfo.Version

	// 2. Check VPN Status
	vpnStatus, err := c.client.GetVPNStatus(ctx)
	if err != nil {
		snapshot.State = StateError
		c.updateProxyEndpoint(proxy.PublicEndpoint{Status: "vpn_offline"})
		c.lastSnapshot = snapshot
		c.broadcast(snapshot)
		return snapshot
	}

	// 3. Check DNS Status
	dnsStatus, _ := c.client.GetDNSStatus(ctx)
	snapshot.DNSStatus = string(dnsStatus)

	// 4. Check Updater Status
	updaterStatus, _ := c.client.GetUpdaterStatus(ctx)
	snapshot.UpdaterStatus = string(updaterStatus)

	// 5. Settings / Provider Info
	vpnSettings, err := c.client.GetVPNSettings(ctx)
	if err == nil {
		snapshot.Provider = vpnSettings.Provider.Name
		snapshot.Protocol = vpnSettings.Type
		if len(vpnSettings.Provider.ServerSelection.Countries) > 0 {
			snapshot.Country = vpnSettings.Provider.ServerSelection.Countries[0]
		}
		if len(vpnSettings.Provider.ServerSelection.Cities) > 0 {
			snapshot.City = vpnSettings.Provider.ServerSelection.Cities[0]
		}
		if len(vpnSettings.Provider.ServerSelection.Hostnames) > 0 {
			snapshot.Hostname = vpnSettings.Provider.ServerSelection.Hostnames[0]
		}
	}

	// 6. Public IP
	var currentIP models.PublicIP
	if vpnStatus == constants.Running {
		currentIP, _ = c.client.GetPublicIP(ctx)
		snapshot.PublicIP = currentIP
		if snapshot.Country == "" && currentIP.Country != "" {
			snapshot.Country = currentIP.Country
		}
		if snapshot.City == "" && currentIP.City != "" {
			snapshot.City = currentIP.City
		}
	}

	// 7. Port Forwarding
	var port uint16
	if vpnStatus == constants.Running {
		port, _, _ = c.client.GetPortForwarded(ctx)
		pfInfo := PortForwardingInfo{
			Port:         port,
			InternalPort: c.internalAppPort,
			Available:    port > 0,
		}

		if currentIP.IP.IsValid() {
			pfInfo.PublicIP = currentIP.IP.String()
			if port > 0 {
				pfInfo.FullEndpoint = fmt.Sprintf("%s:%d", currentIP.IP.String(), port)
				pfInfo.Status = "active"
			} else {
				pfInfo.Status = "unavailable"
			}
		} else {
			pfInfo.Status = "pending"
		}

		snapshot.PortForwarding = pfInfo
	}

	// 8. Determine Connection State
	var state ConnectionState
	switch {
	case vpnStatus == constants.Stopped:
		state = StateDisconnected
		c.connectedSince = nil
	case vpnStatus == constants.Running && !currentIP.IP.IsValid():
		state = StateConnecting
	case vpnStatus == constants.Running && currentIP.IP.IsValid():
		if dnsStatus == constants.Stopped {
			state = StateDegraded
		} else {
			state = StateConnected
		}
		if c.connectedSince == nil {
			now := time.Now()
			c.connectedSince = &now
			if c.lastSnapshot.State == StateDisconnected || c.lastSnapshot.State == StateConnecting {
				c.reconnectionCount++
				c.historyStore.AddEvent(history.HistoryEvent{
					Type:     history.EventConnectionState,
					Severity: "info",
					Title:    "VPN Connected",
					Message:  fmt.Sprintf("Tunnel established to %s (%s)", snapshot.Country, currentIP.IP.String()),
				})
			}
		}
	default:
		state = StateUnknown
	}

	snapshot.State = state
	snapshot.ConnectedSince = c.connectedSince
	snapshot.ReconnectionCount = c.reconnectionCount
	if c.connectedSince != nil {
		snapshot.UptimeSeconds = int64(time.Since(*c.connectedSince).Seconds())
	}

	// 9. IP Change Detection
	if currentIP.IP.IsValid() && currentIP.IP.String() != c.lastKnownIP {
		if c.lastKnownIP != "" {
			c.historyStore.AddEvent(history.HistoryEvent{
				Type:     history.EventIPChange,
				Severity: "info",
				Title:    "Public IP Changed",
				Message:  fmt.Sprintf("Public IP changed from %s to %s (%s)", c.lastKnownIP, currentIP.IP.String(), currentIP.Country),
				Metadata: map[string]any{
					"old_ip":  c.lastKnownIP,
					"new_ip":  currentIP.IP.String(),
					"country": currentIP.Country,
				},
			})
		}
		c.lastKnownIP = currentIP.IP.String()
	}

	// 10. Port Change Detection (ignore port 0 changes)
	if port > 0 && port != c.lastKnownPort {
		if c.lastKnownPort > 0 {
			c.historyStore.AddEvent(history.HistoryEvent{
				Type:     history.EventPortChange,
				Severity: "info",
				Title:    "Forwarded Port Reallocated",
				Message:  fmt.Sprintf("Assigned forwarded port changed from %d to %d", c.lastKnownPort, port),
				Metadata: map[string]any{
					"old_port": c.lastKnownPort,
					"new_port": port,
				},
			})
		} else {
			c.historyStore.AddEvent(history.HistoryEvent{
				Type:     history.EventPortChange,
				Severity: "info",
				Title:    "Forwarded Port Assigned",
				Message:  fmt.Sprintf("Assigned public port %d", port),
				Metadata: map[string]any{
					"port": port,
				},
			})
		}
		c.lastKnownPort = port
	}

	// 11. Telegram Notification on IP or Port Change
	if currentIP.IP.IsValid() && (currentIP.IP.String() != c.lastNotifiedIP || (port > 0 && port != c.lastNotifiedPort)) {
		c.lastNotifiedIP = currentIP.IP.String()
		if port > 0 {
			c.lastNotifiedPort = port
		}
		if c.telegramNotifier != nil && c.telegramNotifier.IsEnabled() {
			notifIP := currentIP.IP.String()
			notifCountry := currentIP.Country
			notifPort := port
			notifier := c.telegramNotifier
			go func() {
				notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				_ = notifier.SendUpdate(notifyCtx, notifIP, notifCountry, notifPort)
			}()
		}
	}

	// 12. Update Reverse Proxy Public Endpoint
	c.updateProxyEndpoint(proxy.PublicEndpoint{
		PublicIP:      currentIP.IP.String(),
		ForwardedPort: port,
		Protocol:      snapshot.Protocol,
		Status:        endpointStatus(state, port),
	})

	// 13. Traffic Sample
	isConnected := state == StateConnected || state == StateDegraded
	snapshot.Traffic = c.trafficMonitor.Sample(isConnected)

	c.lastSnapshot = snapshot
	c.broadcast(snapshot)
	return snapshot
}

func (c *Coordinator) updateProxyEndpoint(endpoint proxy.PublicEndpoint) {
	if c.proxyUpdater == nil {
		return
	}
	endpoint.InternalPort = c.internalAppPort
	c.proxyUpdater.UpdatePublicEndpoint(endpoint)
}

func endpointStatus(state ConnectionState, port uint16) string {
	switch state {
	case StateConnected, StateDegraded:
		if port > 0 {
			return "active"
		}
		return "pending"
	case StateConnecting, StateReconnecting, StateDisconnecting:
		return "pending"
	default:
		return "vpn_offline"
	}
}

func (c *Coordinator) GetSnapshot() LiveSnapshot {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.lastSnapshot
}

func (c *Coordinator) Subscribe() chan LiveSnapshot {
	ch := make(chan LiveSnapshot, 10)
	c.subscribersMutex.Lock()
	c.subscribers[ch] = struct{}{}
	c.subscribersMutex.Unlock()

	// Immediately send current snapshot
	c.mutex.RLock()
	current := c.lastSnapshot
	c.mutex.RUnlock()

	select {
	case ch <- current:
	default:
	}

	return ch
}

func (c *Coordinator) Unsubscribe(ch chan LiveSnapshot) {
	c.subscribersMutex.Lock()
	delete(c.subscribers, ch)
	close(ch)
	c.subscribersMutex.Unlock()
}

func (c *Coordinator) broadcast(snapshot LiveSnapshot) {
	c.subscribersMutex.Lock()
	defer c.subscribersMutex.Unlock()

	for ch := range c.subscribers {
		select {
		case ch <- snapshot:
		default:
		}
	}
}

func (c *Coordinator) notifyStateChange() {
	c.mutex.RLock()
	snapshot := c.lastSnapshot
	snapshot.OperationInProgress = c.IsOperationInProgress()
	c.mutex.RUnlock()
	c.broadcast(snapshot)
}

func (c *Coordinator) Client() gluetun.Client {
	return c.client
}

func (c *Coordinator) History() *history.Store {
	return c.historyStore
}

func (c *Coordinator) Profiles() *profiles.Store {
	return c.profileStore
}
