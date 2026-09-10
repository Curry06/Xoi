package proxy

import (
	"errors"
	"fmt"
	"net/netip"
	"regexp"
	"slices"
	"strings"
)

var (
	errEmptyRouteName       = errors.New("route name cannot be empty")
	errInvalidRoutingType   = errors.New("routing type must be 'domain' or 'path'")
	errEmptyDomain          = errors.New("domain name cannot be empty for domain routing")
	errInvalidDomain        = errors.New("domain format is invalid")
	errEmptyPath            = errors.New("path cannot be empty for path routing")
	errInvalidPath          = errors.New("path must start with '/' and contain only valid URL characters")
	errEmptyTargetHost      = errors.New("target host cannot be empty")
	errInvalidTargetHost    = errors.New("target host is invalid (0.0.0.0 is not allowed)")
	errTargetNotAllowed     = errors.New("target host is not allowed by the proxy target policy")
	errZeroTargetPort       = errors.New("target port must be greater than 0")
	errReservedPort         = errors.New("target port is reserved for internal infrastructure")
	errInvalidProtocol      = errors.New("protocol must be 'http', 'https', or 'websocket'")
	errPublicTLSUnsupported = errors.New("public TLS requires DNS-01 or a supplied certificate and is not configured")
	errDuplicateDomain      = errors.New("another route with this domain already exists")
	errDuplicatePath        = errors.New("another route with this path already exists")
	errOverlappingPath      = errors.New("another route overlaps this path prefix")
	errDuplicateTarget      = errors.New("another route already uses this target host and port")

	domainRegex = regexp.MustCompile(`^(?i)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)
	pathRegex   = regexp.MustCompile(`^/[a-zA-Z0-9_\-\./]*$`)
)

func validateRouteFields(route ProxyRoute) error {
	return validateRouteWithPolicy(route, defaultTargetPolicy())
}

func validateRouteWithPolicy(route ProxyRoute, targetPolicy TargetPolicy) error {
	if strings.TrimSpace(route.Name) == "" {
		return errEmptyRouteName
	}

	switch route.RoutingType {
	case RoutingTypeDomain:
		if strings.TrimSpace(route.Domain) == "" {
			return errEmptyDomain
		}
		cleanDomain := strings.ToLower(strings.TrimSpace(route.Domain))
		if !domainRegex.MatchString(cleanDomain) {
			return fmt.Errorf("%w: %s", errInvalidDomain, route.Domain)
		}
	case RoutingTypePath:
		if strings.TrimSpace(route.Path) == "" {
			return errEmptyPath
		}
		if !strings.HasPrefix(route.Path, "/") || !pathRegex.MatchString(route.Path) {
			return fmt.Errorf("%w: %s", errInvalidPath, route.Path)
		}
	default:
		return errInvalidRoutingType
	}

	protocol := strings.ToLower(strings.TrimSpace(route.Protocol))
	switch protocol {
	case "http", "https", "websocket":
	default:
		return fmt.Errorf("%w: %s", errInvalidProtocol, route.Protocol)
	}

	if route.TLS {
		return errPublicTLSUnsupported
	}

	return validateTarget(route.TargetHost, route.TargetPort, targetPolicy)
}

func validateTarget(targetHost string, targetPort uint16, targetPolicy TargetPolicy) error {
	host := strings.ToLower(strings.TrimSpace(targetHost))
	if host == "" {
		return errEmptyTargetHost
	}
	if slices.Contains(targetPolicy.DeniedHosts, host) {
		return fmt.Errorf("%w: %s", errTargetNotAllowed, targetHost)
	}

	if targetPort == 0 {
		return errZeroTargetPort
	}

	if slices.Contains(targetPolicy.ReservedPorts, targetPort) {
		return fmt.Errorf("%w: port %d", errReservedPort, targetPort)
	}

	parsedIP, err := netip.ParseAddr(host)
	if err == nil {
		if parsedIP.IsUnspecified() {
			return errInvalidTargetHost
		}
		if parsedIP.IsLinkLocalUnicast() || parsedIP.IsLinkLocalMulticast() {
			return fmt.Errorf("%w: %s", errTargetNotAllowed, targetHost)
		}
		if parsedIP.IsLoopback() || slices.Contains(targetPolicy.AllowedHosts, host) {
			return nil
		}
		return fmt.Errorf("%w: %s", errTargetNotAllowed, targetHost)
	}

	if slices.Contains(targetPolicy.AllowedHosts, host) {
		return nil
	}

	return fmt.Errorf("%w: %s", errTargetNotAllowed, targetHost)
}

func checkRouteCollisions(newRoute ProxyRoute, existingRoutes []ProxyRoute) error {
	for _, existing := range existingRoutes {
		if existing.ID == newRoute.ID {
			continue
		}

		if newRoute.RoutingType == RoutingTypeDomain && existing.RoutingType == RoutingTypeDomain {
			if strings.EqualFold(strings.TrimSpace(newRoute.Domain), strings.TrimSpace(existing.Domain)) {
				return fmt.Errorf("%w: %s", errDuplicateDomain, newRoute.Domain)
			}
		}

		if newRoute.RoutingType == RoutingTypePath && existing.RoutingType == RoutingTypePath {
			newPath := strings.TrimRight(strings.TrimSpace(newRoute.Path), "/")
			existingPath := strings.TrimRight(strings.TrimSpace(existing.Path), "/")
			if strings.EqualFold(newPath, existingPath) {
				return fmt.Errorf("%w: %s", errDuplicatePath, newRoute.Path)
			}
			if pathsOverlap(newPath, existingPath) {
				return fmt.Errorf("%w: %s", errOverlappingPath, newRoute.Path)
			}
		}

		if strings.EqualFold(strings.TrimSpace(newRoute.TargetHost), strings.TrimSpace(existing.TargetHost)) &&
			newRoute.TargetPort == existing.TargetPort {
			return fmt.Errorf("%w: %s:%d", errDuplicateTarget, newRoute.TargetHost, newRoute.TargetPort)
		}
	}

	return nil
}

func pathsOverlap(firstPath, secondPath string) bool {
	if firstPath == "/" || secondPath == "/" {
		return true
	}
	return strings.HasPrefix(firstPath, secondPath+"/") || strings.HasPrefix(secondPath, firstPath+"/")
}
