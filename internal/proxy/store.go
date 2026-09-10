package proxy

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

var (
	errRouteNotFound = errors.New("route not found")
)

type Store struct {
	mutex    sync.RWMutex
	filePath string
	routes   map[string]ProxyRoute
}

func NewStore(filePath string) (*Store, error) {
	store := &Store{
		filePath: filePath,
		routes:   make(map[string]ProxyRoute),
	}

	if filePath != "" {
		err := store.loadFromFile()
		if err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("loading routes from file: %w", err)
		}
	}

	return store, nil
}

func (s *Store) List() []ProxyRoute {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	result := make([]ProxyRoute, 0, len(s.routes))
	for _, route := range s.routes {
		result = append(result, route)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.Before(result[j].CreatedAt)
	})

	return result
}

func (s *Store) Get(id string) (ProxyRoute, bool) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	route, exists := s.routes[id]
	return route, exists
}

func (s *Store) Save(route ProxyRoute) error {
	now := time.Now()
	if route.ID == "" {
		route.ID = generateRouteID()
		route.CreatedAt = now
	}
	route.UpdatedAt = now

	routes := s.List()
	for index := range routes {
		if routes[index].ID == route.ID {
			routes[index] = route
			return s.Replace(routes)
		}
	}

	routes = append(routes, route)
	return s.Replace(routes)
}

func (s *Store) Delete(id string) error {
	routes := s.List()
	updatedRoutes := make([]ProxyRoute, 0, len(routes))
	found := false
	for _, route := range routes {
		if route.ID == id {
			found = true
			continue
		}
		updatedRoutes = append(updatedRoutes, route)
	}

	if !found {
		return errRouteNotFound
	}

	return s.Replace(updatedRoutes)
}

// Replace atomically persists and swaps the complete desired route set.
func (s *Store) Replace(routes []ProxyRoute) error {
	routeMap := make(map[string]ProxyRoute, len(routes))
	for _, route := range routes {
		if route.ID == "" {
			return errors.New("route ID cannot be empty")
		}
		if _, exists := routeMap[route.ID]; exists {
			return fmt.Errorf("duplicate route ID: %s", route.ID)
		}
		routeMap[route.ID] = route
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.filePath != "" {
		err := s.saveRoutesToFile(routes)
		if err != nil {
			return fmt.Errorf("saving route set to file: %w", err)
		}
	}

	s.routes = routeMap
	return nil
}

func (s *Store) UpdateStatus(id string, status RouteStatus, latencyMs int64) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	route, exists := s.routes[id]
	if !exists {
		return
	}

	now := time.Now()
	route.Status = status
	route.ResponseTimeMs = latencyMs
	route.LastHealthAt = &now
	s.routes[id] = route
}

func (s *Store) loadFromFile() error {
	fileBytes, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var loaded []ProxyRoute
	err = json.Unmarshal(fileBytes, &loaded)
	if err != nil {
		return fmt.Errorf("unmarshaling proxy routes: %w", err)
	}

	s.routes = make(map[string]ProxyRoute, len(loaded))
	for _, route := range loaded {
		s.routes[route.ID] = route
	}

	return nil
}

func (s *Store) saveRoutesToFile(routes []ProxyRoute) error {
	dir := filepath.Dir(s.filePath)
	err := os.MkdirAll(dir, 0o750)
	if err != nil {
		return fmt.Errorf("creating directory: %w", err)
	}

	routesList := make([]ProxyRoute, len(routes))
	copy(routesList, routes)

	sort.Slice(routesList, func(i, j int) bool {
		return routesList[i].CreatedAt.Before(routesList[j].CreatedAt)
	})

	data, err := json.MarshalIndent(routesList, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling proxy routes: %w", err)
	}

	tempFile := s.filePath + ".tmp"
	err = os.WriteFile(tempFile, data, 0o600)
	if err != nil {
		return fmt.Errorf("writing temp file: %w", err)
	}

	err = os.Rename(tempFile, s.filePath)
	if err != nil {
		return fmt.Errorf("renaming temp file: %w", err)
	}

	return nil
}

func generateRouteID() string {
	bytes := make([]byte, 6)
	_, err := rand.Read(bytes)
	if err != nil {
		return fmt.Sprintf("route_%d", time.Now().UnixNano())
	}
	return "route_" + hex.EncodeToString(bytes)
}
