import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveSnapshot } from '../types';
import { apiClient } from '../api/client';

const initialSnapshot: LiveSnapshot = {
  state: 'unknown',
  engine_online: true,
  engine_version: '...',
  dashboard_version: '1.0.0',
  is_mock: false,
  provider: 'protonvpn',
  protocol: 'wireguard',
  public_ip: {},
  tunnel_interface: 'tun0',
  uptime_seconds: 0,
  reconnection_count: 0,
  dns_status: 'running',
  updater_status: 'stopped',
  port_forwarding: {
    available: false,
    port: 0,
    internal_port: 8080,
    public_ip: '',
    full_endpoint: '',
    status: 'unavailable',
  },
  traffic: {
    available: false,
    download_rate: 0,
    upload_rate: 0,
    total_download: 0,
    total_upload: 0,
    history_1m: [],
    history_15m: [],
    history_1h: [],
  },
  capabilities: {
    can_connect: true,
    can_disconnect: true,
    can_reconnect: true,
    can_switch_server_runtime: true,
    can_change_protocol_runtime: false,
    can_control_dns_runtime: true,
    can_read_port_forwarding: true,
    can_read_traffic: true,
    can_control_firewall: false,
    can_read_version: true,
    can_read_public_ip: true,
    can_read_updater_status: true,
    can_control_updater_runtime: true,
  },
  operation_in_progress: false,
  last_updated: new Date().toISOString(),
};

export function useLiveState() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(initialSnapshot);
  const [isSSEConnected, setIsSSEConnected] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isStale, setIsStale] = useState(false);
  const [lastSuccessTime, setLastSuccessTime] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Poll fallback
  const fetchStatus = useCallback(async () => {
    try {
      const latest = await apiClient.getStatus();
      setSnapshot(latest);
      setLastSuccessTime(Date.now());
      setIsStale(false);
      setIsOffline(false);
    } catch {
      // Mark degraded if unable to reach API
      if (Date.now() - lastSuccessTime > 10000) {
        setIsStale(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [lastSuccessTime]);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchStatus();
    };
    const handleOffline = () => {
      setIsOffline(true);
      setIsStale(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchStatus]);

  // SSE Stream setup with fallback polling
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        const es = new EventSource('/api/dashboard/events/stream');
        eventSourceRef.current = es;

        es.addEventListener('status', (event) => {
          try {
            const data = JSON.parse(event.data) as LiveSnapshot;
            setSnapshot(data);
            setLastSuccessTime(Date.now());
            setIsStale(false);
            setIsSSEConnected(true);
            setIsLoading(false);
          } catch {
            // Ignore parse error
          }
        });

        es.onopen = () => {
          setIsSSEConnected(true);
          setIsStale(false);
        };

        es.onerror = () => {
          setIsSSEConnected(false);
          es.close();

          // Fallback to 5-second polling if SSE drops
          if (!pollInterval) {
            pollInterval = setInterval(fetchStatus, 5000);
          }
          // Retry SSE after 8 seconds
          setTimeout(connectSSE, 8000);
        };
      } catch {
        setIsSSEConnected(false);
        if (!pollInterval) {
          pollInterval = setInterval(fetchStatus, 5000);
        }
      }
    };

    // Initial fetch to get data immediately
    fetchStatus();
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [fetchStatus]);

  // Stale check interval (every 3s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastSuccessTime > 12000) {
        setIsStale(true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [lastSuccessTime]);

  const updateSnapshot = useCallback((newSnapshot: LiveSnapshot) => {
    setSnapshot(newSnapshot);
    setLastSuccessTime(Date.now());
    setIsStale(false);
  }, []);

  return {
    snapshot,
    updateSnapshot,
    refresh: fetchStatus,
    isSSEConnected,
    isOffline,
    isStale,
    isLoading,
  };
}

export { formatBytes, formatRate, formatUptime, getStateBadgeClass } from '../utils/format';
