package web

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"os"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

// Handler returns an HTTP handler serving the embedded SPA with fallback to index.html for client routing.
func Handler() http.Handler {
	subFS, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic("failed getting sub filesystem: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(subFS))

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		// Do not intercept API routes
		if strings.HasPrefix(request.URL.Path, "/api/") {
			http.NotFound(writer, request)
			return
		}

		cleanPath := strings.TrimPrefix(request.URL.Path, "/")
		if cleanPath == "" {
			cleanPath = "index.html"
		}

		// Check if file exists in embedded assets
		file, err := subFS.Open(cleanPath)
		if err == nil {
			_ = file.Close()
			fileServer.ServeHTTP(writer, request)
			return
		}

		// Fallback to index.html for client-side SPA routing (React Router)
		indexFile, err := subFS.Open("index.html")
		if err != nil {
			http.Error(writer, "index.html not found in embedded frontend", http.StatusInternalServerError)
			return
		}
		defer indexFile.Close()

		stat, err := indexFile.Stat()
		if err != nil {
			http.Error(writer, "stat error for index.html", http.StatusInternalServerError)
			return
		}

		if seeker, ok := indexFile.(io.ReadSeeker); ok {
			http.ServeContent(writer, request, "index.html", stat.ModTime(), seeker)
			return
		}

		// Fallback reading
		data, err := os.ReadFile("web/dist/index.html")
		if err == nil {
			writer.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = writer.Write(data)
			return
		}

		fileServer.ServeHTTP(writer, request)
	})
}
