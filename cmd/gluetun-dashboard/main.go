package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/qdm12/gluetun/internal/dashboard/api"
	"github.com/qdm12/gluetun/internal/dashboard/auth"
	"github.com/qdm12/gluetun/internal/dashboard/gluetun"
	"github.com/qdm12/gluetun/internal/dashboard/history"
	"github.com/qdm12/gluetun/internal/dashboard/notify"
	"github.com/qdm12/gluetun/internal/dashboard/profiles"
	"github.com/qdm12/gluetun/internal/dashboard/state"
	"github.com/qdm12/gluetun/internal/dashboard/web"
	"github.com/qdm12/gluetun/internal/proxy"
	"github.com/qdm12/gluetun/internal/storage"
	"github.com/qdm12/gosplash"
	"github.com/qdm12/log"
)

//nolint:gochecknoglobals
var (
	version   = "1.0.0"
	commit    = "unknown"
	buildDate = "an unknown date"
)

func main() {
	logger := log.New(log.SetLevel(log.LevelInfo))

	// Display splash info
	lines := gosplash.MakeLines(gosplash.Settings{
		User:         "passteque",
		Repository:   "gluetun-control-center",
		Emails:       []string{"passteque@protonmail.ch"},
		Version:      version,
		Commit:       commit,
		Created:      buildDate,
		Announcement: "Gluetun Control Center - Production Management Dashboard",
	})
	for _, line := range lines {
		logger.Info(line)
	}

	background := context.Background()
	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, os.Interrupt, syscall.SIGTERM)
	ctx, cancel := context.WithCancel(background)

	errorChannel := make(chan error, 1)
	go func() {
		errorChannel <- run(ctx, logger)
	}()

	var runErr error
	select {
	case receivedSignal := <-signalChannel:
		signal.Stop(signalChannel)
		logger.Warn("Caught OS signal " + receivedSignal.String() + ", initiating graceful shutdown...")
		cancel()
	case runErr = <-errorChannel:
		if runErr != nil && !errors.Is(runErr, http.ErrServerClosed) {
			logger.Error(runErr.Error())
		}
		cancel()
	}

	// Graceful shutdown wait
	const shutdownTimeout = 5 * time.Second
	timer := time.NewTimer(shutdownTimeout)
	select {
	case shutdownErr := <-errorChannel:
		timer.Stop()
		if shutdownErr != nil && !errors.Is(shutdownErr, http.ErrServerClosed) {
			logger.Warnf("Shutdown completed with error: %s", shutdownErr)
			os.Exit(1)
		}
		logger.Info("Shutdown completed successfully")
		os.Exit(0)
	case <-timer.C:
		logger.Warn("Shutdown timed out after 5s, exiting immediately")
		os.Exit(1)
	}
}

func run(ctx context.Context, logger log.LoggerInterface) error {
	// Read environment configuration
	gluetunURL := getEnv("GLUETUN_CONTROL_URL", "http://127.0.0.1:8000")
	gluetunAPIKey := getEnvSecret("GLUETUN_CONTROL_API_KEY", "")
	isMock := getEnvBool("GLUETUN_MOCK", false)
	listenAddress := getEnv("DASHBOARD_HTTP_ADDRESS", "127.0.0.1:9090")
	authRequired := getEnvBool("DASHBOARD_AUTH_REQUIRED", true)
	adminUsername := getEnv("DASHBOARD_ADMIN_USERNAME", "admin")
	adminPassword := getEnvSecret("DASHBOARD_ADMIN_PASSWORD", "admin")
	dataDir := getEnv("DASHBOARD_DATA_DIR", "./data")
	internalPort := uint16(getEnvInt("DASHBOARD_INTERNAL_PORT", 8080))
	allowedOriginsRaw := getEnv("DASHBOARD_ALLOWED_ORIGINS", "")
	telegramEnabled := getEnvBool("TELEGRAM_ENABLED", false)
	telegramToken := getEnvSecret("TELEGRAM_BOT_TOKEN", "")
	telegramChatID := getEnv("TELEGRAM_CHAT_ID", "")
	caddyAdminURL := getEnv("CADDY_ADMIN_URL", "unix:///run/caddy/admin.sock")
	caddyIngressURL := getEnv("CADDY_INGRESS_URL", "http://gluetun:8080")
	proxyAllowedTargetHosts := getEnvStrings("DASHBOARD_PROXY_ALLOWED_TARGET_HOSTS")
	proxyDeniedTargetHosts := getEnvStrings("DASHBOARD_PROXY_DENIED_TARGET_HOSTS")
	proxyReservedTargetPorts := getEnvUint16s("DASHBOARD_PROXY_RESERVED_TARGET_PORTS")

	var allowedOrigins []string
	if allowedOriginsRaw != "" {
		for _, origin := range strings.Split(allowedOriginsRaw, ",") {
			cleaned := strings.TrimSpace(origin)
			if cleaned != "" {
				allowedOrigins = append(allowedOrigins, cleaned)
			}
		}
	}

	if isMock {
		logger.Warn(">>> RUNNING IN MOCK MODE (DEMO DATA ENABLED) <<<")
		logger.Warn("No connection will be made to Gluetun engine port 8000")
	} else {
		logger.Infof("Connecting to Gluetun engine at: %s", gluetunURL)
	}

	// 1. Initialize Gluetun Client
	var client gluetun.Client
	if isMock {
		client = gluetun.NewMockClient(gluetun.ScenarioConnected)
	} else {
		httpClient := &http.Client{
			Timeout: 10 * time.Second,
		}
		client = gluetun.NewRealClient(httpClient, gluetunURL, gluetunAPIKey)
	}

	// 2. Initialize Embedded Server Storage (reads built-in ProtonVPN servers etc.)
	storageLogger := logger.New(log.SetComponent("storage"))
	serverStorage, err := storage.New(storageLogger, false, "", "")
	if err != nil {
		logger.Warnf("Unable to load embedded server storage: %s", err)
	}

	// 3. Initialize Stores
	historyPath := filepath.Join(dataDir, "history.json")
	profilesPath := filepath.Join(dataDir, "profiles.json")
	routesPath := filepath.Join(dataDir, "proxy_routes.json")

	historyStore := history.NewStore(historyPath)
	profileStore, err := profiles.NewStore(profilesPath)
	if err != nil {
		return fmt.Errorf("initializing profile store: %w", err)
	}
	proxyStore, err := proxy.NewStore(routesPath)
	if err != nil {
		return fmt.Errorf("initializing proxy route store: %w", err)
	}

	var proxyProvider proxy.ProxyProvider
	if isMock {
		proxyProvider = proxy.NewMockProvider(internalPort)
	} else {
		proxyProvider = proxy.NewCaddyProvider(caddyAdminURL, internalPort)
	}

	healthChecker := proxy.NewTargetHealthChecker(3 * time.Second)
	healthChecker.SetIngressURL(caddyIngressURL)
	proxyManager := proxy.NewManager(proxyStore, proxyProvider, healthChecker, internalPort)
	proxyManager.SetTargetPolicy(proxy.TargetPolicy{
		AllowedHosts:  proxyAllowedTargetHosts,
		DeniedHosts:   proxyDeniedTargetHosts,
		ReservedPorts: proxyReservedTargetPorts,
	})
	proxyManager.Start(ctx, 15*time.Second)

	// 4. Initialize Coordinator
	coordinator := state.NewCoordinator(client, historyStore, profileStore, version, internalPort)
	coordinator.SetProxyUpdater(proxyManager)

	// 5. Initialize Telegram Notifier (if configured)
	telegramHTTPClient := &http.Client{
		Timeout: 10 * time.Second,
	}
	telegramNotifier := notify.NewTelegramNotifier(telegramHTTPClient, telegramToken, telegramChatID, telegramEnabled)
	coordinator.SetTelegramNotifier(telegramNotifier)
	if telegramNotifier.IsEnabled() {
		logger.Info("Telegram notifications ENABLED")
	} else {
		logger.Info("Telegram notifications configured but inactive (disabled or missing token/chat_id)")
	}

	coordinator.Start(ctx, 2500*time.Millisecond)

	// 6. Initialize Authenticator
	authenticator := auth.NewAuthenticator(adminUsername, adminPassword, authRequired, 24*time.Hour)

	// 7. Build HTTP API and SPA Router
	apiHandler := api.NewAPIHandler(coordinator, authenticator, serverStorage)
	apiHandler.SetTelegramNotifier(telegramNotifier)
	apiHandler.SetProxyManager(proxyManager)
	apiRouter := api.NewRouter(apiHandler, allowedOrigins)

	spaHandler := web.Handler()

	rootMux := http.NewServeMux()
	rootMux.Handle("/api/", apiRouter)
	rootMux.Handle("/", spaHandler)

	server := &http.Server{
		Addr:              listenAddress,
		Handler:           rootMux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Server shutdown listener
	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 4*time.Second)
		defer shutdownCancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	logger.Infof("Gluetun Control Center web dashboard listening on http://%s", listenAddress)
	if authRequired {
		logger.Infof("Admin authentication ENABLED (user: %s)", adminUsername)
	} else {
		logger.Info("Admin authentication DISABLED (open access)")
	}

	err = server.ListenAndServe()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("http server failed: %w", err)
	}

	return nil
}

func getEnvSecret(key, defaultValue string) string {
	if filePath, exists := os.LookupEnv(key + "_FILE"); exists && filePath != "" {
		data, err := os.ReadFile(filePath)
		if err == nil {
			return strings.TrimSpace(string(data))
		}
	}
	return getEnv(key, defaultValue)
}

func getEnv(key, defaultValue string) string {
	val, exists := os.LookupEnv(key)
	if !exists || val == "" {
		return defaultValue
	}
	return val
}

func getEnvBool(key string, defaultValue bool) bool {
	val, exists := os.LookupEnv(key)
	if !exists || val == "" {
		return defaultValue
	}
	return strings.EqualFold(val, "true") || val == "1"
}

func getEnvInt(key string, defaultValue int) int {
	val, exists := os.LookupEnv(key)
	if !exists || val == "" {
		return defaultValue
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return defaultValue
	}
	return parsed
}

func getEnvStrings(key string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return nil
	}

	values := strings.Split(value, ",")
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			result = append(result, value)
		}
	}
	return result
}

func getEnvUint16s(key string) []uint16 {
	values := getEnvStrings(key)
	result := make([]uint16, 0, len(values))
	for _, value := range values {
		parsed, err := strconv.ParseUint(value, 10, 16)
		if err != nil || parsed == 0 {
			continue
		}
		result = append(result, uint16(parsed))
	}
	return result
}
