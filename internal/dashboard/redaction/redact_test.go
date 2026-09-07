package redaction

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_RedactString(t *testing.T) {
	t.Parallel()

	testCases := map[string]struct {
		input    string
		expected string
	}{
		"empty_string": {
			input:    "",
			expected: "",
		},
		"normal_string": {
			input:    "server connected successfully",
			expected: "server connected successfully",
		},
		"wireguard_base64_key": {
			input:    "private key is 4b8v6sJ3+f0n0i2N9lM9dZ7a1b3c5e7g9h1j3k5m7o0= in config",
			expected: "private key is [REDACTED] in config",
		},
		"bearer_token": {
			input:    "Authorization: Bearer mySecretToken123456",
			expected: "Authorization: Bearer [REDACTED]",
		},
		"api_key_param": {
			input:    "https://example.com/api?api_key=secretKeyABC",
			expected: "https://example.com/api?api_key=[REDACTED]",
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			actual := RedactString(testCase.input)
			assert.Equal(t, testCase.expected, actual)
		})
	}
}

func Test_RedactMap(t *testing.T) {
	t.Parallel()

	testCases := map[string]struct {
		input    map[string]any
		expected map[string]any
	}{
		"nil_map": {
			input:    nil,
			expected: nil,
		},
		"map_with_secrets": {
			input: map[string]any{
				"username": "admin",
				"password": "supersecretpassword",
				"api_key":  "secret123",
				"nested": map[string]any{
					"token": "tok999",
					"host":  "vpn.example.com",
				},
				"list": []any{
					"normal",
					map[string]any{
						"secret_data": "shhh",
					},
				},
			},
			expected: map[string]any{
				"username": "admin",
				"password": "[REDACTED]",
				"api_key":  "[REDACTED]",
				"nested": map[string]any{
					"token": "[REDACTED]",
					"host":  "vpn.example.com",
				},
				"list": []any{
					"normal",
					map[string]any{
						"secret_data": "[REDACTED]",
					},
				},
			},
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			actual := RedactMap(testCase.input)
			assert.Equal(t, testCase.expected, actual)
		})
	}
}

func Test_IsSensitiveKey(t *testing.T) {
	t.Parallel()

	testCases := map[string]struct {
		key      string
		expected bool
	}{
		"password": {
			key:      "password",
			expected: true,
		},
		"wireguard_private_key": {
			key:      "wireguard_private_key",
			expected: true,
		},
		"auth_token": {
			key:      "auth_token",
			expected: true,
		},
		"safe_key": {
			key:      "server_country",
			expected: false,
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			actual := IsSensitiveKey(testCase.key)
			assert.Equal(t, testCase.expected, actual)
		})
	}
}
