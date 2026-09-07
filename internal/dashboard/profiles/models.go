package profiles

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrProfileNotFound    = errors.New("profile not found")
	ErrInvalidProfileName = errors.New("profile name cannot be empty")
	ErrInvalidProvider    = errors.New("provider cannot be empty")
	ErrInvalidProtocol    = errors.New("protocol must be wireguard, openvpn_udp, or openvpn_tcp")
)

type Profile struct {
	ID                string     `json:"id"`
	Name              string     `json:"name"`
	Provider          string     `json:"provider"`
	Country           string     `json:"country,omitempty"`
	Region            string     `json:"region,omitempty"`
	City              string     `json:"city,omitempty"`
	Hostname          string     `json:"hostname,omitempty"`
	Protocol          string     `json:"protocol"` // wireguard, openvpn_udp, openvpn_tcp
	PortForwarding    bool       `json:"port_forwarding"`
	BlockMalicious    bool       `json:"block_malicious"`
	BlockAds          bool       `json:"block_ads"`
	BlockSurveillance bool       `json:"block_surveillance"`
	IsFavorite        bool       `json:"is_favorite"`
	LastUsedAt        *time.Time `json:"last_used_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func (p *Profile) Validate() error {
	trimmedName := strings.TrimSpace(p.Name)
	if trimmedName == "" {
		return ErrInvalidProfileName
	}
	p.Name = trimmedName

	trimmedProvider := strings.TrimSpace(p.Provider)
	if trimmedProvider == "" {
		return ErrInvalidProvider
	}
	p.Provider = trimmedProvider

	validProtocols := map[string]bool{
		"wireguard":   true,
		"openvpn_udp": true,
		"openvpn_tcp": true,
		"openvpn":     true,
	}

	cleanProtocol := strings.ToLower(strings.TrimSpace(p.Protocol))
	if cleanProtocol == "" {
		cleanProtocol = "wireguard"
	}
	if !validProtocols[cleanProtocol] {
		return ErrInvalidProtocol
	}
	p.Protocol = cleanProtocol

	return nil
}

func GenerateProfileID() string {
	bytes := make([]byte, 8)
	_, _ = rand.Read(bytes)
	return fmt.Sprintf("prof_%s", hex.EncodeToString(bytes))
}
