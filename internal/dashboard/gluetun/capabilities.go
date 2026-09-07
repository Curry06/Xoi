package gluetun

type Capabilities struct {
	CanConnect               bool `json:"can_connect"`
	CanDisconnect            bool `json:"can_disconnect"`
	CanReconnect             bool `json:"can_reconnect"`
	CanSwitchServerRuntime   bool `json:"can_switch_server_runtime"`
	CanChangeProtocolRuntime bool `json:"can_change_protocol_runtime"`
	CanControlDNSRuntime     bool `json:"can_control_dns_runtime"`
	CanReadPortForwarding    bool `json:"can_read_port_forwarding"`
	CanReadTraffic           bool `json:"can_read_traffic"`
	CanControlFirewall       bool `json:"can_control_firewall"`
	CanReadVersion           bool `json:"can_read_version"`
	CanReadPublicIP          bool `json:"can_read_public_ip"`
	CanReadUpdaterStatus     bool `json:"can_read_updater_status"`
	CanControlUpdaterRuntime bool `json:"can_control_updater_runtime"`
}

func DefaultCapabilities() Capabilities {
	return Capabilities{
		CanConnect:               true,
		CanDisconnect:            true,
		CanReconnect:             true,
		CanSwitchServerRuntime:   true,
		CanChangeProtocolRuntime: false, // Requires full container reconfig/restart
		CanControlDNSRuntime:     true,
		CanReadPortForwarding:    true,
		CanReadTraffic:           true,  // Provided by dashboard host/tunnel adapter
		CanControlFirewall:       false, // Kill switch is engine invariant, non-configurable runtime
		CanReadVersion:           true,
		CanReadPublicIP:          true,
		CanReadUpdaterStatus:     true,
		CanControlUpdaterRuntime: true,
	}
}
