package proxy

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type TargetHealthChecker struct {
	httpClient *http.Client
	ingressURL string
}

func NewTargetHealthChecker(timeout time.Duration) *TargetHealthChecker {
	if timeout <= 0 {
		timeout = 3 * time.Second
	}

	return &TargetHealthChecker{
		httpClient: &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				DisableKeepAlives: true,
			},
		},
	}
}

func (checker *TargetHealthChecker) SetIngressURL(ingressURL string) {
	checker.ingressURL = strings.TrimRight(strings.TrimSpace(ingressURL), "/")
}

func (h *TargetHealthChecker) ProbeTarget(ctx context.Context, targetHost string, targetPort uint16) TargetProbeResult {
	start := time.Now()
	targetAddress := net.JoinHostPort(targetHost, fmt.Sprintf("%d", targetPort))

	// First try TCP dial
	dialer := net.Dialer{Timeout: 2 * time.Second}
	conn, dialErr := dialer.DialContext(ctx, "tcp", targetAddress)
	if dialErr != nil {
		return TargetProbeResult{
			Reachable: false,
			LatencyMs: time.Since(start).Milliseconds(),
			Error:     fmt.Sprintf("connection refused: %s", dialErr.Error()),
		}
	}
	_ = conn.Close()

	// Try lightweight HTTP GET request
	url := fmt.Sprintf("http://%s/", targetAddress)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return TargetProbeResult{
			Reachable:  true,
			LatencyMs:  time.Since(start).Milliseconds(),
			StatusCode: 200,
		}
	}

	resp, err := h.httpClient.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		// TCP succeeded even if HTTP returned EOF or connection reset (e.g. non-HTTP service or raw websocket)
		return TargetProbeResult{
			Reachable:  true,
			LatencyMs:  latency,
			StatusCode: 200,
		}
	}
	defer resp.Body.Close()

	return TargetProbeResult{
		Reachable:  true,
		LatencyMs:  latency,
		StatusCode: resp.StatusCode,
	}
}

func (checker *TargetHealthChecker) ProbeRoute(ctx context.Context, route ProxyRoute) TargetProbeResult {
	if checker.ingressURL == "" {
		return checker.ProbeTarget(ctx, route.TargetHost, route.TargetPort)
	}

	parsedIngressURL, err := url.Parse(checker.ingressURL)
	if err != nil || parsedIngressURL.Scheme == "" || parsedIngressURL.Host == "" {
		return TargetProbeResult{Error: "Caddy ingress URL is invalid"}
	}

	if route.RoutingType == RoutingTypePath {
		parsedIngressURL.Path = route.Path
	} else {
		parsedIngressURL.Path = "/"
	}

	start := time.Now()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsedIngressURL.String(), nil)
	if err != nil {
		return TargetProbeResult{Error: fmt.Sprintf("creating route health request: %s", err)}
	}
	if route.RoutingType == RoutingTypeDomain {
		request.Host = route.Domain
	}

	response, err := checker.httpClient.Do(request)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return TargetProbeResult{
			LatencyMs: latency,
			Error:     fmt.Sprintf("sending route health request: %s", err),
		}
	}
	defer response.Body.Close()

	return TargetProbeResult{
		Reachable:  response.StatusCode < http.StatusInternalServerError,
		LatencyMs:  latency,
		StatusCode: response.StatusCode,
	}
}
