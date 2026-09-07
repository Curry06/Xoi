import React, { useState, useEffect, useCallback } from 'react';
import { useLiveState } from './hooks/useLiveState';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OverviewPage } from './pages/OverviewPage';
import { ServersPage } from './pages/ServersPage';
import { PortForwardingPage } from './pages/PortForwardingPage';
import { NetworkPage } from './pages/NetworkPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
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
      case '/servers':
        return <ServersPage snapshot={snapshot} onRefresh={handleDataRefresh} />;
      case '/port-forwarding':
        return <PortForwardingPage snapshot={snapshot} historyEvents={historyEvents} />;
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
