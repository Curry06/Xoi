package gluetun

import (
	"context"

	"github.com/qdm12/gluetun/internal/configuration/settings"
	"github.com/qdm12/gluetun/internal/models"
)

type Client interface {
	GetVersion(ctx context.Context) (models.BuildInformation, error)
	GetVPNStatus(ctx context.Context) (models.LoopStatus, error)
	SetVPNStatus(ctx context.Context, status models.LoopStatus) (string, error)
	GetVPNSettings(ctx context.Context) (settings.VPN, error)
	SetVPNSettings(ctx context.Context, override settings.VPN) (string, error)
	GetDNSStatus(ctx context.Context) (models.LoopStatus, error)
	SetDNSStatus(ctx context.Context, status models.LoopStatus) (string, error)
	GetUpdaterStatus(ctx context.Context) (models.LoopStatus, error)
	SetUpdaterStatus(ctx context.Context, status models.LoopStatus) (string, error)
	GetPublicIP(ctx context.Context) (models.PublicIP, error)
	GetPortForwarded(ctx context.Context) (uint16, []uint16, error)
	IsMock() bool
	GetCapabilities() Capabilities
}
