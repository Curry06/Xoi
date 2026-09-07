package gluetun

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/qdm12/gluetun/internal/configuration/settings"
	"github.com/qdm12/gluetun/internal/models"
)

var (
	ErrEngineUnavailable = errors.New("gluetun engine is unavailable")
	ErrUnexpectedStatus  = errors.New("unexpected response status from gluetun")
)

type RealClient struct {
	httpClient   *http.Client
	baseURL      string
	apiKey       string
	capabilities Capabilities
}

func NewRealClient(httpClient *http.Client, baseURL, apiKey string) *RealClient {
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: 10 * time.Second,
		}
	}
	cleanBaseURL := strings.TrimRight(baseURL, "/")

	return &RealClient{
		httpClient:   httpClient,
		baseURL:      cleanBaseURL,
		apiKey:       apiKey,
		capabilities: DefaultCapabilities(),
	}
}

func (c *RealClient) IsMock() bool {
	return false
}

func (c *RealClient) GetCapabilities() Capabilities {
	return c.capabilities
}

func (c *RealClient) SetCapabilities(capabilities Capabilities) {
	c.capabilities = capabilities
}

func (c *RealClient) doRequest(ctx context.Context, method, endpoint string, requestBody any, target any) error {
	url := fmt.Sprintf("%s%s", c.baseURL, endpoint)

	var bodyReader io.Reader
	if requestBody != nil {
		bodyBytes, err := json.Marshal(requestBody)
		if err != nil {
			return fmt.Errorf("marshaling request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	request, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	request.Header.Set("Accept", "application/json")
	if requestBody != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if c.apiKey != "" {
		request.Header.Set("X-API-Key", c.apiKey)
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrEngineUnavailable, err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(response.Body)
		return fmt.Errorf("%w: status %d: %s", ErrUnexpectedStatus, response.StatusCode, string(bodyBytes))
	}

	if target != nil {
		decoder := json.NewDecoder(response.Body)
		if err := decoder.Decode(target); err != nil {
			return fmt.Errorf("decoding response body: %w", err)
		}
	}

	return nil
}

func (c *RealClient) GetVersion(ctx context.Context) (models.BuildInformation, error) {
	var buildInfo models.BuildInformation
	err := c.doRequest(ctx, http.MethodGet, "/v1/version", nil, &buildInfo)
	if err != nil {
		return models.BuildInformation{}, fmt.Errorf("fetching version: %w", err)
	}
	return buildInfo, nil
}

type statusResponse struct {
	Status string `json:"status"`
}

type outcomeResponse struct {
	Outcome string `json:"outcome"`
}

func (c *RealClient) GetVPNStatus(ctx context.Context) (models.LoopStatus, error) {
	var response statusResponse
	err := c.doRequest(ctx, http.MethodGet, "/v1/vpn/status", nil, &response)
	if err != nil {
		return "", fmt.Errorf("fetching vpn status: %w", err)
	}
	return models.LoopStatus(response.Status), nil
}

func (c *RealClient) SetVPNStatus(ctx context.Context, status models.LoopStatus) (string, error) {
	payload := map[string]string{"status": string(status)}
	var response outcomeResponse
	err := c.doRequest(ctx, http.MethodPut, "/v1/vpn/status", payload, &response)
	if err != nil {
		return "", fmt.Errorf("setting vpn status: %w", err)
	}
	return response.Outcome, nil
}

func (c *RealClient) GetVPNSettings(ctx context.Context) (settings.VPN, error) {
	var vpnSettings settings.VPN
	err := c.doRequest(ctx, http.MethodGet, "/v1/vpn/settings", nil, &vpnSettings)
	if err != nil {
		return settings.VPN{}, fmt.Errorf("fetching vpn settings: %w", err)
	}
	return vpnSettings, nil
}

func (c *RealClient) SetVPNSettings(ctx context.Context, override settings.VPN) (string, error) {
	url := fmt.Sprintf("%s/v1/vpn/settings", c.baseURL)
	bodyBytes, err := json.Marshal(override)
	if err != nil {
		return "", fmt.Errorf("marshaling vpn settings: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		request.Header.Set("X-API-Key", c.apiKey)
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrEngineUnavailable, err)
	}
	defer response.Body.Close()

	bodyBytes, err = io.ReadAll(response.Body)
	if err != nil {
		return "", fmt.Errorf("reading response: %w", err)
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("%w: status %d: %s", ErrUnexpectedStatus, response.StatusCode, string(bodyBytes))
	}

	return string(bodyBytes), nil
}

func (c *RealClient) GetDNSStatus(ctx context.Context) (models.LoopStatus, error) {
	var response statusResponse
	err := c.doRequest(ctx, http.MethodGet, "/v1/dns/status", nil, &response)
	if err != nil {
		return "", fmt.Errorf("fetching dns status: %w", err)
	}
	return models.LoopStatus(response.Status), nil
}

func (c *RealClient) SetDNSStatus(ctx context.Context, status models.LoopStatus) (string, error) {
	payload := map[string]string{"status": string(status)}
	var response outcomeResponse
	err := c.doRequest(ctx, http.MethodPut, "/v1/dns/status", payload, &response)
	if err != nil {
		return "", fmt.Errorf("setting dns status: %w", err)
	}
	return response.Outcome, nil
}

func (c *RealClient) GetUpdaterStatus(ctx context.Context) (models.LoopStatus, error) {
	var response statusResponse
	err := c.doRequest(ctx, http.MethodGet, "/v1/updater/status", nil, &response)
	if err != nil {
		return "", fmt.Errorf("fetching updater status: %w", err)
	}
	return models.LoopStatus(response.Status), nil
}

func (c *RealClient) SetUpdaterStatus(ctx context.Context, status models.LoopStatus) (string, error) {
	payload := map[string]string{"status": string(status)}
	var response outcomeResponse
	err := c.doRequest(ctx, http.MethodPut, "/v1/updater/status", payload, &response)
	if err != nil {
		return "", fmt.Errorf("setting updater status: %w", err)
	}
	return response.Outcome, nil
}

func (c *RealClient) GetPublicIP(ctx context.Context) (models.PublicIP, error) {
	var publicIP models.PublicIP
	err := c.doRequest(ctx, http.MethodGet, "/v1/publicip/ip", nil, &publicIP)
	if err != nil {
		return models.PublicIP{}, fmt.Errorf("fetching public ip: %w", err)
	}
	return publicIP, nil
}

type portForwardResponse struct {
	Port  uint16   `json:"port"`
	Ports []uint16 `json:"ports"`
}

func (c *RealClient) GetPortForwarded(ctx context.Context) (uint16, []uint16, error) {
	var response portForwardResponse
	err := c.doRequest(ctx, http.MethodGet, "/v1/portforward", nil, &response)
	if err != nil {
		return 0, nil, fmt.Errorf("fetching forwarded port: %w", err)
	}

	validPort := response.Port
	// If response.Port is 0 but Ports has entries, check first entry
	if validPort == 0 && len(response.Ports) > 0 {
		validPort = response.Ports[0]
	}

	return validPort, response.Ports, nil
}
