package redaction

import (
	"regexp"
	"strings"
)

var sensitiveKeysRegex = regexp.MustCompile(`(?i)(key|pass|secret|token|auth|credential|wireguard.*key|preshared)`)

const redactedPlaceholder = "[REDACTED]"

// RedactString redacts known sensitive token/key patterns from arbitrary strings.
func RedactString(input string) string {
	if input == "" {
		return ""
	}

	// Redact standard base64 keys (44 chars with 1 or 2 padding '=' symbols)
	wgKeyRegex := regexp.MustCompile(`([A-Za-z0-9+/]{42,43}={1,2})`)
	redacted := wgKeyRegex.ReplaceAllString(input, redactedPlaceholder)

	// Redact bearer tokens or api keys in strings
	authHeaderRegex := regexp.MustCompile(`(?i)(bearer\s+|api_key=)[A-Za-z0-9_\-\.]+`)
	redacted = authHeaderRegex.ReplaceAllString(redacted, "$1"+redactedPlaceholder)

	return redacted
}

// RedactMap recursively creates a sanitized copy of a map, masking any keys matching sensitive keywords.
func RedactMap(source map[string]any) map[string]any {
	if source == nil {
		return nil
	}

	result := make(map[string]any, len(source))
	for key, value := range source {
		if sensitiveKeysRegex.MatchString(key) {
			result[key] = redactedPlaceholder
			continue
		}

		switch typedValue := value.(type) {
		case map[string]any:
			result[key] = RedactMap(typedValue)
		case []any:
			result[key] = redactSlice(typedValue)
		case string:
			result[key] = RedactString(typedValue)
		default:
			result[key] = value
		}
	}

	return result
}

func redactSlice(source []any) []any {
	result := make([]any, len(source))
	for index, item := range source {
		switch typedItem := item.(type) {
		case map[string]any:
			result[index] = RedactMap(typedItem)
		case []any:
			result[index] = redactSlice(typedItem)
		case string:
			result[index] = RedactString(typedItem)
		default:
			result[index] = item
		}
	}
	return result
}

// IsSensitiveKey returns true if the key name indicates sensitive credential information.
func IsSensitiveKey(key string) bool {
	return sensitiveKeysRegex.MatchString(strings.TrimSpace(key))
}
