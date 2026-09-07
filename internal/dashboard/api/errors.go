package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
)

type APIError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
	RequestID string `json:"request_id"`
}

type ErrorEnvelope struct {
	Error APIError `json:"error"`
}

func generateRequestID() string {
	bytes := make([]byte, 8)
	_, _ = rand.Read(bytes)
	return fmt.Sprintf("req_%s", hex.EncodeToString(bytes))
}

func writeJSON(writer http.ResponseWriter, statusCode int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(statusCode)
	_ = json.NewEncoder(writer).Encode(payload)
}

func writeError(writer http.ResponseWriter, statusCode int, code string, message string, retryable bool) {
	requestID := generateRequestID()
	envelope := ErrorEnvelope{
		Error: APIError{
			Code:      code,
			Message:   message,
			Retryable: retryable,
			RequestID: requestID,
		},
	}
	writeJSON(writer, statusCode, envelope)
}
