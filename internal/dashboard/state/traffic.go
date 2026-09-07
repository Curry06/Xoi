package state

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type TrafficMonitor struct {
	mutex           sync.RWMutex
	isMock          bool
	targetInterface string
	lastRxBytes     uint64
	lastTxBytes     uint64
	lastSampleTime  time.Time
	totalRxBytes    uint64
	totalTxBytes    uint64
	currentRxRate   uint64
	currentTxRate   uint64
	history1m       []TrafficPoint
	history15m      []TrafficPoint
	history1h       []TrafficPoint
}

func NewTrafficMonitor(targetInterface string, isMock bool) *TrafficMonitor {
	if targetInterface == "" {
		targetInterface = "tun0"
	}
	return &TrafficMonitor{
		targetInterface: targetInterface,
		isMock:          isMock,
		lastSampleTime:  time.Now(),
		history1m:       make([]TrafficPoint, 0, 60),
		history15m:      make([]TrafficPoint, 0, 90),
		history1h:       make([]TrafficPoint, 0, 120),
	}
}

func (tm *TrafficMonitor) Sample(isConnected bool) TrafficMetrics {
	tm.mutex.Lock()
	defer tm.mutex.Unlock()

	now := time.Now()
	elapsed := now.Sub(tm.lastSampleTime).Seconds()
	if elapsed <= 0 {
		elapsed = 1.0
	}
	tm.lastSampleTime = now

	var rxRate, txRate uint64
	available := false

	if tm.isMock {
		if isConnected {
			available = true
			// Generate realistic mock rates: 4MB/s - 14MB/s down, 500KB/s - 2MB/s up
			jitter := uint64(rand.Intn(4 * 1024 * 1024))
			rxRate = (8 * 1024 * 1024) + jitter
			txRate = (800 * 1024) + (jitter / 4)
			tm.totalRxBytes += uint64(float64(rxRate) * elapsed)
			tm.totalTxBytes += uint64(float64(txRate) * elapsed)
		}
	} else if isConnected {
		// Read real linux net dev interface counters
		rx, tx, err := readInterfaceCounters(tm.targetInterface)
		if err == nil {
			available = true
			if tm.lastRxBytes > 0 && rx >= tm.lastRxBytes {
				rxRate = uint64(float64(rx-tm.lastRxBytes) / elapsed)
			}
			if tm.lastTxBytes > 0 && tx >= tm.lastTxBytes {
				txRate = uint64(float64(tx-tm.lastTxBytes) / elapsed)
			}
			tm.lastRxBytes = rx
			tm.lastTxBytes = tx
			tm.totalRxBytes = rx
			tm.totalTxBytes = tx
		}
	}

	tm.currentRxRate = rxRate
	tm.currentTxRate = txRate

	point := TrafficPoint{
		Timestamp:    now,
		DownloadRate: rxRate,
		UploadRate:   txRate,
	}

	// Maintain 1m (every 1-2s, max 60 points)
	tm.history1m = append(tm.history1m, point)
	if len(tm.history1m) > 60 {
		tm.history1m = tm.history1m[1:]
	}

	// Maintain 15m (sample periodically, max 90 points)
	if len(tm.history15m) == 0 || now.Sub(tm.history15m[len(tm.history15m)-1].Timestamp) >= 10*time.Second {
		tm.history15m = append(tm.history15m, point)
		if len(tm.history15m) > 90 {
			tm.history15m = tm.history15m[1:]
		}
	}

	// Maintain 1h (sample periodically, max 120 points)
	if len(tm.history1h) == 0 || now.Sub(tm.history1h[len(tm.history1h)-1].Timestamp) >= 30*time.Second {
		tm.history1h = append(tm.history1h, point)
		if len(tm.history1h) > 120 {
			tm.history1h = tm.history1h[1:]
		}
	}

	return TrafficMetrics{
		Available:       available,
		Interface:       tm.targetInterface,
		DownloadRate:    tm.currentRxRate,
		UploadRate:      tm.currentTxRate,
		TotalDownloaded: tm.totalRxBytes,
		TotalUploaded:   tm.totalTxBytes,
		History1m:       copyPoints(tm.history1m),
		History15m:      copyPoints(tm.history15m),
		History1h:       copyPoints(tm.history1h),
	}
}

func copyPoints(points []TrafficPoint) []TrafficPoint {
	result := make([]TrafficPoint, len(points))
	copy(result, points)
	return result
}

func readInterfaceCounters(interfaceName string) (rxBytes, txBytes uint64, err error) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, fmt.Errorf("opening /proc/net/dev: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.Contains(line, ":") {
			continue
		}

		parts := strings.Split(line, ":")
		if len(parts) != 2 {
			continue
		}

		name := strings.TrimSpace(parts[0])
		if name != interfaceName && name != "tun0" && name != "wg0" {
			continue
		}

		fields := strings.Fields(parts[1])
		if len(fields) < 9 {
			continue
		}

		rx, err1 := strconv.ParseUint(fields[0], 10, 64)
		tx, err2 := strconv.ParseUint(fields[8], 10, 64)
		if err1 == nil && err2 == nil {
			return rx, tx, nil
		}
	}

	return 0, 0, fmt.Errorf("interface %s not found", interfaceName)
}
