import React, { useState, useEffect, useCallback } from 'react';
import { useLiveState } from './hooks/useLiveState';
import { useVPNState } from './hooks/useVPNState';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OverviewPage } from './pages/OverviewPage';
import { ServersPage } from './pages/ServersPage';
import { PortForwardingPage } from './pages/PortForwardingPage';
import { NetworkPage } from './pages/NetworkPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { PublicApplicationsPage } from './pages/PublicApplicationsPage';

// Control Plane Views
import { LiveTrafficGraph } from './components/traffic/LiveTrafficGraph';
import { TrafficByApp } from './components/traffic/TrafficByApp';
import { TrafficByDestination } from './components/traffic/TrafficByDestination';
import { ActiveConnectionsView } from './components/connections/ActiveConnectionsView';
import { RoutingView } from './components/routing/RoutingView';
import { FirewallView } from './components/firewall/FirewallView';
import { DNSView } from './components/dns/DNSView';
import { DevicesView } from './components/devices/DevicesView';
import { SecurityView } from './components/security/SecurityView';
import { SystemView } from './components/system/SystemView';

import { Profile, HistoryEvent } from './types';
import { apiClient } from './api/client';
import { ToastProvider } from './components/Toast';
import './styles/theme.css';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const p = window.location.pathname;
    return p === '/' ? '/overview' : p;
  });

  const { snapshot, refresh, isOffline, isStale, isLoading } = useLiveState();
  const vpnState = useVPNState(snapshot);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);

  const fetchAuxiliaryData = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([
        apiClient.getProfiles().catch(() => []),
        apiClient.getHistory({ limit: 100 }).catch(() => []),
      ]);
      setProfiles(p);
      setHistoryEvents(h);
    } catch {
      // Ignore initial aux errors
    }
  }, []);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p === '/' ? '/overview' : p);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  };

  const handleDataRefresh = () => {
    refresh();
    fetchAuxiliaryData();
  };

  const renderCurrentPage = () => {
    switch (currentPath) {
      case '/traffic':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <LiveTrafficGraph
              data={vpnState.trafficHistory}
              peakMbps={vpnState.metrics.peakMbps}
              averageMbps={vpnState.metrics.averageMbps}
              currentDown={vpnState.metrics.downloadMbps}
              currentUp={vpnState.metrics.uploadMbps}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
              <TrafficByApp items={vpnState.appTraffic} totalMbps={vpnState.metrics.downloadMbps + vpnState.metrics.uploadMbps} />
              <TrafficByDestination destinations={vpnState.destinations} />
            </div>
          </div>
        );

      case '/connections':
        return <ActiveConnectionsView connections={vpnState.connections} />;

      case '/routing':
        return <RoutingView routes={vpnState.routes} interfaceName={vpnState.settings.interfaceName} />;

      case '/firewall':
        return (
          <FirewallView
            stats={vpnState.firewallStats}
            events={vpnState.firewallEvents}
            killSwitchActive={vpnState.settings.killSwitchActive}
          />
        );

      case '/dns':
        return <DNSView metrics={vpnState.dnsMetrics} />;

      case '/devices':
        return <DevicesView devices={vpnState.devices} />;

      case '/security':
        return <SecurityView events={vpnState.securityEvents} />;

      case '/system':
        return <SystemView metrics={vpnState.systemHealth} />;

      case '/servers':
        return <ServersPage snapshot={snapshot} onRefresh={handleDataRefresh} />;

      case '/port-forwarding':
        return <PortForwardingPage snapshot={snapshot} historyEvents={historyEvents} />;

      case '/applications':
        return <PublicApplicationsPage snapshot={snapshot} onRefresh={handleDataRefresh} />;

      case '/network':
        return <NetworkPage snapshot={snapshot} onRefresh={handleDataRefresh} />;

      case '/profiles':
        return <ProfilesPage profiles={profiles} onRefresh={handleDataRefresh} />;

      case '/activity':
        return <ActivityPage events={historyEvents} onRefresh={handleDataRefresh} />;

      case '/settings':
        return <SettingsPage snapshot={snapshot} onRefresh={handleDataRefresh} />;

      case '/overview':
      default:
        return (
          <OverviewPage
            snapshot={snapshot}
            vpnState={vpnState}
            onRefresh={handleDataRefresh}
            onNavigate={navigate}
            profiles={profiles}
          />
        );
    }
  };

  return (
    <ToastProvider>
      <DashboardLayout
        currentPath={currentPath}
        onNavigate={navigate}
        snapshot={snapshot}
        vpnState={vpnState.state}
        vpnSettings={vpnState.settings}
        vpnMetrics={vpnState.metrics}
        isOffline={isOffline}
        isStale={isStale}
      >
        {isLoading && snapshot.state === 'unknown' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              color: 'var(--text-muted)',
              fontSize: '1rem',
            }}
          >
            Connecting to Gluetun Control Center...
          </div>
        ) : (
          renderCurrentPage()
        )}
      </DashboardLayout>
    </ToastProvider>
  );
};
