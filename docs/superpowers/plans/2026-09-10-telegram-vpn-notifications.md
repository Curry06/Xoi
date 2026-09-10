# Telegram VPN IP & Port Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated Telegram notifications when Gluetun's VPN public IP or forwarded port changes, along with an admin dashboard toggle/settings control.

**Architecture:** 
A dedicated `notify` package in `internal/dashboard/notify` manages Telegram Bot API communication. The `state.Coordinator` triggers notifications whenever an IP change or port change occurs (with debouncing/deduplication). REST API endpoints (`/api/dashboard/settings/telegram`) provide full runtime control to toggle auto-send and update credentials, integrated into the frontend Settings page.

**Tech Stack:** Go 1.26, React 19, TypeScript, Telegram Bot API (HTTP REST).

---

## Global Constraints
- Minimal and targeted code changes following repository `AGENTS.md` guidelines.
- Standard Go conventions: descriptive variable names, no panics for user inputs, context-aware HTTP requests.
- Sensitive values (Bot Token) must be redacted when returned to the UI.
- All outbound Telegram requests must have timeouts and run asynchronously so they never block the VPN coordinator loop.

---

### Task 1: Telegram Notifier Package & Unit Tests

**Files:**
- Create: `internal/dashboard/notify/telegram.go`
- Create: `internal/dashboard/notify/telegram_test.go`

**Interfaces:**
- Produces:
  - `type Notifier interface`
  - `func NewTelegramNotifier(client *http.Client, token, chatID string, enabled bool) *TelegramNotifier`
  - `func (n *TelegramNotifier) SendUpdate(ctx context.Context, ip, country string, port uint16) error`
  - `func (n *TelegramNotifier) SendTest(ctx context.Context) error`
  - `func (n *TelegramNotifier) GetSettings() Settings`
  - `func (n *TelegramNotifier) UpdateSettings(enabled bool, token, chatID string)`

- [x] **Step 1: Write unit tests for TelegramNotifier**
  Create `internal/dashboard/notify/telegram_test.go` testing message construction, markdown escaping, HTTP POST to Telegram API URL (`/bot<TOKEN>/sendMessage`), error handling, and disabled state skipping.

- [x] **Step 2: Run test to verify it fails**
  Run: `go test -v ./internal/dashboard/notify/...`
  Expected: FAIL (package does not exist yet)

- [x] **Step 3: Implement TelegramNotifier**
  Create `internal/dashboard/notify/telegram.go` implementing `TelegramNotifier` with thread-safe settings storage (`sync.RWMutex`), HTTP client calls to Telegram API, message formatting, and test send.

- [x] **Step 4: Run test to verify it passes**
  Run: `go test -v ./internal/dashboard/notify/...`
  Expected: PASS

---

### Task 2: State Coordinator Integration

**Files:**
- Modify: `internal/dashboard/state/coordinator.go`
- Modify: `internal/dashboard/state/coordinator_test.go` (if applicable)

**Interfaces:**
- Consumes: `notify.TelegramNotifier`
- Produces: Automatic notification trigger on `EventIPChange` and `EventPortChange`

- [x] **Step 1: Update Coordinator struct and constructor**
  Add notifier dependency to `Coordinator` and maintain `lastNotifiedIP` and `lastNotifiedPort` to avoid duplicate messages.

- [x] **Step 2: Trigger Telegram notification on IP or Port changes**
  In `Refresh()`, when `currentIP.IP.String() != c.lastKnownIP` or `port != c.lastKnownPort`, call `notifier.SendUpdate(...)` asynchronously in a background goroutine with a 10s context.

- [x] **Step 3: Verify with unit tests**
  Run: `go test -v ./internal/dashboard/state/...`
  Expected: PASS

---

### Task 3: REST API Endpoints & Configuration Wireup

**Files:**
- Modify: `internal/dashboard/api/handler.go`
- Modify: `internal/dashboard/api/router.go`
- Modify: `cmd/gluetun-dashboard/main.go`
- Modify: `.env` and `.env.example`
- Modify: `docker-compose.dashboard.yml`

**Interfaces:**
- Endpoints:
  - `GET /api/dashboard/settings/telegram` -> `{ "enabled": bool, "chat_id": string, "token_set": bool }`
  - `POST /api/dashboard/settings/telegram` -> Update settings
  - `POST /api/dashboard/settings/telegram/test` -> Send test message to Telegram

- [x] **Step 1: Add Telegram environment variables**
  Add `TELEGRAM_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` to `.env.example`, `.env`, and `docker-compose.dashboard.yml`.

- [x] **Step 2: Add API handlers for Telegram settings and test message**
  Implement handlers in `internal/dashboard/api/handler.go` and register routes in `internal/dashboard/api/router.go`.

- [x] **Step 3: Wire up in main.go**
  Initialize `TelegramNotifier` with env vars in `cmd/gluetun-dashboard/main.go` and inject into coordinator and API handler.

- [x] **Step 4: Test API endpoints**
  Run: `go test -v ./internal/dashboard/api/...`
  Expected: PASS

---

### Task 4: Frontend Settings Page UI Integration

**Files:**
- Modify: `web/src/api/client.ts`
- Modify: `web/src/pages/SettingsPage.tsx`
- Modify: `web/src/types/index.ts`

- [x] **Step 1: Add Telegram API client methods in TypeScript**
  Add `getTelegramSettings()`, `updateTelegramSettings()`, and `sendTelegramTest()` in `web/src/api/client.ts`.

- [x] **Step 2: Add Telegram configuration card in SettingsPage**
  Add UI card in `SettingsPage.tsx` with toggle switch for auto-send, Bot Token input, Chat ID input, "Send Test Message" button with toast alert, and "Save Settings" button.

- [x] **Step 3: Rebuild and verify frontend**
  Run: `npm --prefix web run build && npm --prefix web run lint`
  Expected: PASS

---

### Task 5: End-to-End Verification & Docker Stack Re-deployment

- [x] **Step 1: Run full Go build and unit tests**
  Run: `go test ./internal/dashboard/...`
  Expected: PASS

- [x] **Step 2: Rebuild Dashboard Docker container**
  Run: `docker compose -f docker-compose.dashboard.yml up -d --build dashboard`

- [x] **Step 3: Verify live endpoint with test message / status**
  Confirm container health and test message functionality.
