package state

import (
	"time"

	"github.com/qdm12/gluetun/internal/dashboard/gluetun"
	"github.com/qdm12/gluetun/internal/models"
)

type ConnectionState string

const (
	StateUnknown       ConnectionState = "unknown"
	StateDisconnected  ConnectionState = "disconnected"
	StateConnecting    ConnectionState = "connecting"
	StateConnected     ConnectionState = "connected"
	StateReconnecting  ConnectionState = "reconnecting"
	StateDisconnecting ConnectionState = "disconnecting"
	StateDegraded      ConnectionState = "degraded"
	StateError         ConnectionState = "error"
)

type TrafficPoint struct {
	Timestamp    time.Time `json:"timestamp"`
	DownloadRate uint64    `json:"download_rate"` // bytes per second
	UploadRate   uint64    `json:"upload_rate"`   // bytes per second
}

type TrafficMetrics struct {
	Available       bool           `json:"available"`
	Interface       string         `json:"interface,omitempty"`
	DownloadRate    uint64         `json:"download_rate"`  // bytes per second
	UploadRate      uint64         `json:"upload_rate"`    // bytes per second
	TotalDownloaded uint64         `json:"total_download"` // total session bytes
	TotalUploaded   uint64         `json:"total_upload"`   // total session bytes
	History1m       []TrafficPoint `json:"history_1m"`
	History15m      []TrafficPoint `json:"history_15m"`
	History1h       []TrafficPoint `json:"history_1h"`
}

type PortForwardingInfo struct {
	Available     bool       `json:"available"`
	Port          uint16     `json:"port"`
	InternalPort  uint16     `json:"internal_port"`
	PublicIP      string     `json:"public_ip"`
	FullEndpoint  string     `json:"full_endpoint"`
	LastAllocated *time.Time `json:"last_allocated,omitempty"`
	Status        string     `json:"status"` // "active", "unavailable", "pending"
}

type LiveSnapshot struct {
	State               ConnectionState      `json:"state"`
	EngineOnline        bool                 `json:"engine_online"`
	EngineVersion       string               `json:"engine_version"`
	DashboardVersion    string               `json:"dashboard_version"`
	IsMock              bool                 `json:"is_mock"`
	MockScenario        string               `json:"mock_scenario,omitempty"`
	Provider            string               `json:"provider"`
	Protocol            string               `json:"protocol"` // "wireguard" or "openvpn"
	Country             string               `json:"country,omitempty"`
	City                string               `json:"city,omitempty"`
	Hostname            string               `json:"hostname,omitempty"`
	PublicIP            models.PublicIP      `json:"public_ip"`
	TunnelInterface     string               `json:"tunnel_interface"`
	UptimeSeconds       int64                `json:"uptime_seconds"`
	ConnectedSince      *time.Time           `json:"connected_since,omitempty"`
	ReconnectionCount   uint32               `json:"reconnection_count"`
	DNSStatus           string               `json:"dns_status"` // "running" or "stopped"
	UpdaterStatus       string               `json:"updater_status"`
	PortForwarding      PortForwardingInfo   `json:"port_forwarding"`
	Traffic             TrafficMetrics       `json:"traffic"`
	Capabilities        gluetun.Capabilities `json:"capabilities"`
	OperationInProgress bool                 `json:"operation_in_progress"`
	LastUpdated         time.Time            `json:"last_updated"`
}
