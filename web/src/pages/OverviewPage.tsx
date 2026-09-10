import React, { useState } from 'react';
import { LiveSnapshot, Profile } from '../types';
import { useVPNState } from '../hooks/useVPNState';
import { apiClient } from '../api/client';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { QRCodeModal } from '../components/QRCodeModal';

// High-fidelity VPN Dashboard Components
import { TunnelHeroFlow } from '../components/tunnel/TunnelHeroFlow';
import { NetworkFlowMap } from '../components/network/NetworkFlowMap';
import { ScenarioSimulatorBar } from '../components/scenarios/ScenarioSimulatorBar';
import { LiveTrafficGraph } from '../components/traffic/LiveTrafficGraph';
import { RealtimeMetricCards } from '../components/metrics/RealtimeMetricCards';
import { ConnectionStatusCard } from '../components/vpn/ConnectionStatusCard';
import { VPNServerCard } from '../components/vpn/VPNServerCard';
import { TrafficByApp } from '../components/traffic/TrafficByApp';
import { TrafficByDestination } from '../components/traffic/TrafficByDestination';

interface OverviewPageProps {
  snapshot: LiveSnapshot;
  vpnState: ReturnType<typeof useVPNState>;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  profiles: Profile[];
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  snapshot,
  vpnState,
  onRefresh,
  onNavigate,
  profiles,
}) => {
  const { showToast } = useToast();
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isReconnectModalOpen, setIsReconnectModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const {
    state,
    statusMessage,
    reconnectStep,
    reconnectProgress,
    settings,
    metrics,
    trafficHistory,
    appTraffic,
    destinations,
    firewallStats,
    dnsMetrics,
    currentScenario,
    useLiveEngine,
    setUseLiveEngine,
    setScenario,
    triggerAction,
    updateServer,
  } = vpnState;

  // 1. Connect
  const handleConnect = async () => {
    try {
      setIsActionLoading(true);
      if (useLiveEngine) {
        await apiClient.vpnConnect();
        showToast('VPN connect requested to live engine', 'info');
        onRefresh();
      } else {
        triggerAction('reconnect');
        showToast('Initiating secure tunnel handshake...', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to start VPN', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 2. Disconnect
  const handleDisconnect = async () => {
    try {
      setIsActionLoading(true);
      if (useLiveEngine) {
        await apiClient.vpnDisconnect();
        showToast('VPN disconnected (Kill Switch Active)', 'info');
        onRefresh();
      } else {
        triggerAction('disconnect');
        showToast('Tunnel severed: Kill switch strictly enforced', 'error');
      }
      setIsDisconnectModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to stop VPN', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 3. Reconnect
  const handleReconnect = async () => {
    try {
      setIsActionLoading(true);
      if (useLiveEngine) {
        await apiClient.vpnReconnect();
        showToast('VPN reconnected successfully', 'success');
        onRefresh();
      } else {
        triggerAction('reconnect');
        showToast('Tunnel renegotiation sequence triggered', 'info');
      }
      setIsReconnectModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to reconnect VPN', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 4. Switch Server
  const handleSwitchServer = (serverName: string, country: string, ip: string) => {
    updateServer(serverName, country, ip);
    showToast(`Migrating tunnel gateway to ${serverName} (${country})`, 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Interactive 10-Scenario Simulator & Mode Bar */}
      <ScenarioSimulatorBar
        currentScenario={currentScenario}
        onSelectScenario={setScenario}
        useLiveEngine={useLiveEngine}
        onToggleLiveEngine={setUseLiveEngine}
        isEngineOnline={snapshot.engine_online}
      />

      {profiles && profiles.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>Active Profile:</span>
          <select
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.2rem 0.5rem',
              fontSize: '0.75rem',
            }}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onNavigate('/profiles');
              }
            }}
          >
            <option value="" disabled>Select Profile...</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.country || 'Global'})</option>
            ))}
          </select>
        </div>
      )}
      {/* 2. Hero Animated Tunnel Visualization (Canvas Particle Flow) */}
      <TunnelHeroFlow
        state={state}
        metrics={metrics}
        settings={settings}
        statusMessage={statusMessage}
        reconnectStep={reconnectStep}
        reconnectProgress={reconnectProgress}
      />

      {/* 3. Realtime 8 Metric Cards with SVG Sparklines */}
      <RealtimeMetricCards
        metrics={metrics}
        settings={settings}
        state={state}
        trafficHistory={trafficHistory}
      />

      {/* 4. Interactive 7-Node Network Topology Pipeline & Drawer */}
      <NetworkFlowMap
        state={state}
        settings={settings}
        firewallStats={firewallStats}
        dnsMetrics={dnsMetrics}
        latencyMs={metrics.latencyMs}
      />

      {/* 5. Dual Time-Series Live Traffic Graph (Ingress / Egress) */}
      <LiveTrafficGraph
        data={trafficHistory}
        peakMbps={metrics.peakMbps}
        averageMbps={metrics.averageMbps}
        currentDown={metrics.downloadMbps}
        currentUp={metrics.uploadMbps}
      />

      {/* 6. Connection Status & VPN Server Node Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <ConnectionStatusCard
          state={state}
          settings={settings}
          statusMessage={statusMessage}
          onDisconnect={() => setIsDisconnectModalOpen(true)}
          onReconnect={() => setIsReconnectModalOpen(true)}
          onConnect={handleConnect}
          onSwitchServer={() => onNavigate('/servers')}
          isLoading={isActionLoading}
        />

        <VPNServerCard
          settings={settings}
          state={state}
          latencyMs={metrics.latencyMs}
          onSwitchServer={handleSwitchServer}
        />
      </div>

      {/* 7. Traffic Breakdown: Applications & Live Destination Hosts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <TrafficByApp items={appTraffic} totalMbps={metrics.downloadMbps + metrics.uploadMbps} />
        <TrafficByDestination destinations={destinations} />
      </div>

      {/* Disconnect Modal */}
      <ConfirmModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect VPN Tunnel?"
        message="Disconnecting will immediately stop encrypted tunnel transport. Gluetun's strict kill switch will be engaged to drop all non-LAN egress traffic and prevent IP leaks."
        confirmLabel="Disconnect Now"
        isDestructive={true}
        isLoading={isActionLoading}
      />

      {/* Reconnect Modal */}
      <ConfirmModal
        isOpen={isReconnectModalOpen}
        onClose={() => setIsReconnectModalOpen(false)}
        onConfirm={handleReconnect}
        title="Reconnect VPN Tunnel?"
        message="This will re-negotiate Wireguard/OpenVPN handshakes and re-verify iptables forwarding tables. Active downloads may pause for 1-2 seconds."
        confirmLabel="Reconnect"
        isLoading={isActionLoading}
      />

      {/* QR Code Modal for Port Forwarding */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        endpoint={`${settings.publicIP}:${settings.portForwarded}`}
      />
    </div>
  );
};
