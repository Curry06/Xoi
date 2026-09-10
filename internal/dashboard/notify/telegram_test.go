package notify_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/qdm12/gluetun/internal/dashboard/notify"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_TelegramNotifier(t *testing.T) {
	t.Parallel()

	testCases := map[string]struct {
		enabled          bool
		botToken         string
		chatID           string
		mockStatusCode   int
		mockResponseBody string
		sendAction       string // "update_with_port", "update_no_port", "test"
		expectedError    string
	}{
		"disabled_notifier": {
			enabled:       false,
			botToken:      "123:TOKEN",
			chatID:        "chat_123",
			sendAction:    "update_with_port",
			expectedError: "telegram notification is disabled",
		},
		"missing_bot_token": {
			enabled:       true,
			botToken:      "",
			chatID:        "chat_123",
			sendAction:    "update_with_port",
			expectedError: "telegram bot token is not configured",
		},
		"missing_chat_id": {
			enabled:       true,
			botToken:      "123:TOKEN",
			chatID:        "",
			sendAction:    "update_with_port",
			expectedError: "telegram chat ID is not configured",
		},
		"successful_send_with_port": {
			enabled:          true,
			botToken:         "123:TOKEN",
			chatID:           "-100123456",
			mockStatusCode:   http.StatusOK,
			mockResponseBody: `{"ok": true, "result": {"message_id": 1}}`,
			sendAction:       "update_with_port",
		},
		"successful_send_no_port": {
			enabled:          true,
			botToken:         "123:TOKEN",
			chatID:           "-100123456",
			mockStatusCode:   http.StatusOK,
			mockResponseBody: `{"ok": true, "result": {"message_id": 2}}`,
			sendAction:       "update_no_port",
		},
		"successful_send_test": {
			enabled:          true,
			botToken:         "123:TOKEN",
			chatID:           "-100123456",
			mockStatusCode:   http.StatusOK,
			mockResponseBody: `{"ok": true, "result": {"message_id": 3}}`,
			sendAction:       "test",
		},
		"telegram_api_error": {
			enabled:          true,
			botToken:         "123:TOKEN",
			chatID:           "-100123456",
			mockStatusCode:   http.StatusBadRequest,
			mockResponseBody: `{"ok": false, "description": "Chat not found"}`,
			sendAction:       "test",
			expectedError:    "telegram API error (status 400)",
		},
	}

	for testName, testCase := range testCases {
		t.Run(testName, func(t *testing.T) {
			t.Parallel()

			var interceptedPayload map[string]string
			mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				bodyBytes, readErr := io.ReadAll(r.Body)
				require.NoError(t, readErr)
				_ = json.Unmarshal(bodyBytes, &interceptedPayload)

				w.WriteHeader(testCase.mockStatusCode)
				_, _ = w.Write([]byte(testCase.mockResponseBody))
			}))
			defer mockServer.Close()

			notifier := notify.NewTelegramNotifier(
				mockServer.Client(),
				testCase.botToken,
				testCase.chatID,
				testCase.enabled,
			)
			notifier.SetAPIBaseURLForTesting(mockServer.URL)

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			var err error
			switch testCase.sendAction {
			case "update_with_port":
				err = notifier.SendUpdate(ctx, "1.2.3.4", "India", 50000)
			case "update_no_port":
				err = notifier.SendUpdate(ctx, "1.2.3.4", "India", 0)
			case "test":
				err = notifier.SendTest(ctx)
			}

			if testCase.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), testCase.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, testCase.chatID, interceptedPayload["chat_id"])
				assert.NotEmpty(t, interceptedPayload["text"])
			}
		})
	}
}
