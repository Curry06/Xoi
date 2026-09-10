package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	ErrTelegramDisabled = errors.New("telegram notification is disabled")
	ErrMissingBotToken  = errors.New("telegram bot token is not configured")
	ErrMissingChatID    = errors.New("telegram chat ID is not configured")
)

type Settings struct {
	Enabled  bool   `json:"enabled"`
	BotToken string `json:"bot_token,omitempty"`
	ChatID   string `json:"chat_id"`
}

type TelegramNotifier struct {
	httpClient     *http.Client
	mutex          sync.RWMutex
	enabled        bool
	botToken       string
	chatID         string
	apiBaseURLTest string
}

func NewTelegramNotifier(httpClient *http.Client, botToken, chatID string, enabled bool) *TelegramNotifier {
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: 10 * time.Second,
		}
	}
	return &TelegramNotifier{
		httpClient: httpClient,
		botToken:   strings.TrimSpace(botToken),
		chatID:     strings.TrimSpace(chatID),
		enabled:    enabled,
	}
}

func (n *TelegramNotifier) SetAPIBaseURLForTesting(apiURL string) {
	n.mutex.Lock()
	defer n.mutex.Unlock()
	n.apiBaseURLTest = apiURL
}

func (n *TelegramNotifier) IsEnabled() bool {
	n.mutex.RLock()
	defer n.mutex.RUnlock()
	return n.enabled && n.botToken != "" && n.chatID != ""
}

func (n *TelegramNotifier) GetSettings() Settings {
	n.mutex.RLock()
	defer n.mutex.RUnlock()
	return Settings{
		Enabled:  n.enabled,
		BotToken: n.botToken,
		ChatID:   n.chatID,
	}
}

func (n *TelegramNotifier) UpdateSettings(enabled bool, botToken, chatID string) {
	n.mutex.Lock()
	defer n.mutex.Unlock()
	n.enabled = enabled
	if strings.TrimSpace(botToken) != "" {
		n.botToken = strings.TrimSpace(botToken)
	}
	n.chatID = strings.TrimSpace(chatID)
}

func (n *TelegramNotifier) SendUpdate(ctx context.Context, publicIP, country string, port uint16) error {
	n.mutex.RLock()
	enabled := n.enabled
	botToken := n.botToken
	chatID := n.chatID
	n.mutex.RUnlock()

	if !enabled {
		return ErrTelegramDisabled
	}
	if botToken == "" {
		return ErrMissingBotToken
	}
	if chatID == "" {
		return ErrMissingChatID
	}

	var messageText string
	nowFormatted := time.Now().UTC().Format("2006-01-02 15:04:05 UTC")
	countryText := ""
	if country != "" {
		countryText = fmt.Sprintf(" (%s)", country)
	}

	if port > 0 {
		endpoint := fmt.Sprintf("%s:%d", publicIP, port)
		messageText = fmt.Sprintf("🛡️ *ProtonVPN Endpoint Updated*\n\n🌐 *Public IP:* `%s`%s\n🔌 *Forwarded Port:* `%d`\n🔗 *Direct Endpoint:* `%s`\n🕒 *Updated At:* `%s`",
			publicIP, countryText, port, endpoint, nowFormatted)
	} else {
		messageText = fmt.Sprintf("🛡️ *ProtonVPN Tunnel Connected*\n\n🌐 *Public IP:* `%s`%s\n🔌 *Forwarded Port:* `Pending / Unavailable`\n🕒 *Updated At:* `%s`",
			publicIP, countryText, nowFormatted)
	}

	return n.sendTextMessage(ctx, botToken, chatID, messageText)
}

func (n *TelegramNotifier) SendTest(ctx context.Context) error {
	n.mutex.RLock()
	botToken := n.botToken
	chatID := n.chatID
	n.mutex.RUnlock()

	if botToken == "" {
		return ErrMissingBotToken
	}
	if chatID == "" {
		return ErrMissingChatID
	}

	messageText := "✅ *Telegram Notifications Working!*\n\nGluetun Control Center successfully connected to your Telegram group/channel."
	return n.sendTextMessage(ctx, botToken, chatID, messageText)
}

func (n *TelegramNotifier) sendTextMessage(ctx context.Context, botToken, chatID, messageText string) error {
	var telegramURL string
	n.mutex.RLock()
	testBaseURL := n.apiBaseURLTest
	n.mutex.RUnlock()

	if testBaseURL != "" {
		telegramURL = fmt.Sprintf("%s/bot%s/sendMessage", testBaseURL, botToken)
	} else {
		telegramURL = fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	}

	payload := map[string]string{
		"chat_id":    chatID,
		"text":       messageText,
		"parse_mode": "Markdown",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encoding telegram payload: %w", err)
	}

	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, telegramURL, bytes.NewReader(jsonPayload))
	if err != nil {
		return fmt.Errorf("creating telegram request: %w", err)
	}
	httpRequest.Header.Set("Content-Type", "application/json")

	httpResponse, err := n.httpClient.Do(httpRequest)
	if err != nil {
		return fmt.Errorf("sending request to telegram API: %w", err)
	}
	defer httpResponse.Body.Close()

	if httpResponse.StatusCode != http.StatusOK {
		responseBody, _ := io.ReadAll(httpResponse.Body)
		return fmt.Errorf("telegram API error (status %d): %s", httpResponse.StatusCode, string(responseBody))
	}

	return nil
}
