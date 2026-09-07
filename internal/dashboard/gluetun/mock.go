package gluetun

import (
	"context"
	"errors"
	"net/netip"
	"sync"
	"time"

	"github.com/qdm12/gluetun/internal/configuration/settings"
	"github.com/qdm12/gluetun/internal/constants"
	"github.com/qdm12/gluetun/internal/constants/providers"
	"github.com/qdm12/gluetun/internal/constants/vpn"
	"github.com/qdm12/gluetun/internal/models"
)

const (
	ScenarioConnected             = "connected"
	ScenarioConnecting            = "connecting"
	ScenarioDisconnected          = "disconnected"
	ScenarioPortUnavailable       = "port_unavailable"
	ScenarioPublicIPUnavailable   = "public_ip_unavailable"
	ScenarioServerSwitchFailure   = "server_switch_failure"
	ScenarioReconnection          = "reconnection"
	ScenarioDegradedDNS           = "degraded_dns"
	ScenarioSlowResponse          = "slow_response"
	ScenarioUnsupportedCapability = "unsupported_capability"
)

type MockClient struct {
	mutex        sync.RWMutex
	scenario     string
	vpnStatus    models.LoopStatus
	dnsStatus    models.LoopStatus
	updaterState models.LoopStatus
	currentIP    models.PublicIP
	forwardPort  uint16
	capabilities Capabilities
	settings     settings.VPN
}

func NewMockClient(initialScenario string) *MockClient {
	if initialScenario == "" {
		initialScenario = ScenarioConnected
	}

	mock := &MockClient{
		capabilities: DefaultCapabilities(),
	}
	mock.SetScenario(initialScenario)
	return mock
}

func (m *MockClient) IsMock() bool {
	return true
}

func (m *MockClient) GetCapabilities() Capabilities {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.capabilities
}

func (m *MockClient) GetScenario() string {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.scenario
}

func (m *MockClient) SetScenario(scenario string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.scenario = scenario
	m.capabilities = DefaultCapabilities()

	// Default VPN settings for ProtonVPN
	m.settings = settings.VPN{
		Type: vpn.Wireguard,
		Provider: settings.Provider{
			Name: providers.Protonvpn,
			ServerSelection: settings.ServerSelection{
				VPN:       vpn.Wireguard,
				Countries: []string{"Switzerland"},
				Cities:    []string{"Zurich"},
				Hostnames: []string{"ch-01.protonvpn.net"},
			},
		},
	}

	switch scenario {
	case ScenarioConnected:
		m.vpnStatus = constants.Running
		m.dnsStatus = constants.Running
		m.updaterState = constants.Stopped
		m.forwardPort = 45823
		m.currentIP = models.PublicIP{
			IP:           netip.MustParseAddr("185.156.175.42"),
			Country:      "Switzerland",
			Region:       "Zurich",
			City:         "Zurich",
			Hostname:     "ch-01.protonvpn.net",
			Organization: "Proton AG",
			Timezone:     "Europe/Zurich",
		}

	case ScenarioConnecting:
		m.vpnStatus = constants.Running
		m.dnsStatus = constants.Stopped
		m.updaterState = constants.Stopped
		m.forwardPort = 0
		m.currentIP = models.PublicIP{}

	case ScenarioDisconnected:
		m.vpnStatus = constants.Stopped
		m.dnsStatus = constants.Stopped
		m.updaterState = constants.Stopped
		m.forwardPort = 0
		m.currentIP = models.PublicIP{}

	case ScenarioPortUnavailable:
		m.vpnStatus = constants.Running
		m.dnsStatus = constants.Running
		m.updaterState = constants.Stopped
		m.forwardPort = 0
		m.currentIP = models.PublicIP{
			IP:           netip.MustParseAddr("185.156.175.42"),
			Country:      "Switzerland",
			Region:       "Zurich",
			City:         "Zurich",
			Hostname:     "ch-01.protonvpn.net",
			Organization: "Proton AG",
			Timezone:     "Europe/Zurich",
		}

	case ScenarioPublicIPUnavailable:
		m.vpnStatus = constants.Running
		m.dnsStatus = constants.Running
		m.updaterState = constants.Stopped
		m.forwardPort = 45823
		m.currentIP = models.PublicIP{}

	case ScenarioDegradedDNS:
		m.vpnStatus = constants.Running
		m.dnsStatus = constants.Stopped
		m.updaterState = constants.Stopped
		m.forwardPort = 45823
		m.currentIP = models.PublicIP{
			IP:           netip.MustParseAddr("185.156.175.42"),
			Country:      "Switzerland",
			Region:       "Zurich",
			City:         "Zurich",
			Hostname:     "ch-01.protonvpn.net",
			Organization: "Proton AG",
			Timezone:     "Europe/Zurich",
		}

	case ScenarioUnsupportedCapability:
		m.vpnStatus = constants.Running
		m.dnsStatus = constants.Running
		m.updaterState = constants.Stopped
		m.forwardPort = 0
		m.capabilities.CanSwitchServerRuntime = false
		m.capabilities.CanReadPortForwarding = false
		m.capabilities.CanReadTraffic = false
		m.capabilities.CanControlDNSRuntime = false

	default:
		m.vpnStatus = constants.Running
		m.dnsStatus = constants.Running
		m.updaterState = constants.Stopped
		m.forwardPort = 45823
	}
}

func (m *MockClient) maybeDelay(ctx context.Context) error {
	m.mutex.RLock()
	isSlow := m.scenario == ScenarioSlowResponse
	m.mutex.RUnlock()

	if isSlow {
		select {
		case <-time.After(1500 * time.Millisecond):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

func (m *MockClient) GetVersion(ctx context.Context) (models.BuildInformation, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return models.BuildInformation{}, err
	}
	return models.BuildInformation{
		Version: "v3.39.1-mock",
		Commit:  "c7a8b9e",
		Created: "2026-09-07T12:00:00Z",
	}, nil
}

func (m *MockClient) GetVPNStatus(ctx context.Context) (models.LoopStatus, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return "", err
	}
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.vpnStatus, nil
}

func (m *MockClient) SetVPNStatus(ctx context.Context, status models.LoopStatus) (string, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return "", err
	}
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.vpnStatus = status
	if status == constants.Stopped {
		m.currentIP = models.PublicIP{}
		m.forwardPort = 0
	} else if status == constants.Running {
		m.currentIP = models.PublicIP{
			IP:           netip.MustParseAddr("185.156.175.42"),
			Country:      "Switzerland",
			City:         "Zurich",
			Hostname:     "ch-01.protonvpn.net",
			Organization: "Proton AG",
		}
		m.forwardPort = 45823
	}
	return "status updated to " + string(status), nil
}

func (m *MockClient) GetVPNSettings(ctx context.Context) (settings.VPN, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return settings.VPN{}, err
	}
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.settings, nil
}

func (m *MockClient) SetVPNSettings(ctx context.Context, override settings.VPN) (string, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return "", err
	}
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.scenario == ScenarioServerSwitchFailure {
		return "", errors.New("mock simulated server switch failure: provider rejected connection")
	}

	m.settings.OverrideWith(override)
	// Update mock IP according to country
	if len(override.Provider.ServerSelection.Countries) > 0 {
		country := override.Provider.ServerSelection.Countries[0]
		m.currentIP.Country = country
		m.currentIP.City = "Default City"
		m.currentIP.IP = netip.MustParseAddr("146.70.120.10")
	}
	return "restarted", nil
}

func (m *MockClient) GetDNSStatus(ctx context.Context) (models.LoopStatus, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return "", err
	}
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.dnsStatus, nil
}

func (m *MockClient) SetDNSStatus(ctx context.Context, status models.LoopStatus) (string, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return "", err
	}
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.dnsStatus = status
	return "dns " + string(status), nil
}

func (m *MockClient) GetUpdaterStatus(ctx context.Context) (models.LoopStatus, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return "", err
	}
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.updaterState, nil
}

func (m *MockClient) SetUpdaterStatus(ctx context.Context, status models.LoopStatus) (string, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return "", err
	}
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.updaterState = status
	return "updater " + string(status), nil
}

func (m *MockClient) GetPublicIP(ctx context.Context) (models.PublicIP, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return models.PublicIP{}, err
	}
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	if m.scenario == ScenarioPublicIPUnavailable || m.vpnStatus == constants.Stopped {
		return models.PublicIP{}, nil
	}
	return m.currentIP, nil
}

func (m *MockClient) GetPortForwarded(ctx context.Context) (uint16, []uint16, error) {
	if err := m.maybeDelay(ctx); err != nil {
		return 0, nil, err
	}
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	if m.scenario == ScenarioPortUnavailable || m.vpnStatus == constants.Stopped || m.forwardPort == 0 {
		return 0, nil, nil
	}
	return m.forwardPort, []uint16{m.forwardPort}, nil
}
