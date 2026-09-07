import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  Power,
  RefreshCw,
  Copy,
  Check,
  Radio,
  ArrowDown,
  ArrowUp,
  Clock,
  QrCode,
  Globe,
  Activity,
  Zap,
} from 'lucide-react';
import { LiveSnapshot, Profile } from '../types';
import { apiClient } from '../api/client';
import { formatBytes, formatRate, formatUptime } from '../hooks/useLiveState';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { QRCodeModal } from '../components/QRCodeModal';
import { TrafficChart } from '../components/TrafficChart';

interface OverviewPageProps {
  snapshot: LiveSnapshot;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  profiles: Profile[];
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  snapshot,
  onRefresh,
  onNavigate,
  profiles,
}) => {
  const { showToast } = useToast();
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isReconnectModalOpen, setIsReconnectModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [endpointTestResult, setEndpointTestResult] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedIP, setCopiedIP] = useState(false);

  const isConnected = snapshot.state === 'connected';
  const isTransitioning = snapshot.state === 'connecting' || snapshot.state === 'reconnecting';
  const pf = snapshot.port_forwarding;
  const isPortValid = pf && pf.port > 0 && pf.port <= 65535;

  // 1. Connect
  const handleConnect = async () => {
    try {
      setIsActionLoading(true);
      await apiClient.vpnConnect();
      showToast('VPN connect requested', 'info');
      onRefresh();
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
      await apiClient.vpnDisconnect();
      showToast('VPN disconnected', 'info');
      setIsDisconnectModalOpen(false);
      onRefresh();
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
      await apiClient.vpnReconnect();
      showToast('VPN reconnected successfully', 'success');
      setIsReconnectModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to reconnect VPN', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 4. Test Endpoint
  const handleTestEndpoint = async () => {
    try {
      setIsTestingEndpoint(true);
      setEndpointTestResult(null);
      const res = await apiClient.testEndpoint();
      if (res.reachable) {
        setEndpointTestResult(`Reachable (${res.message})`);
        showToast('Forwarded port reachable!', 'success');
      } else {
        setEndpointTestResult(`Unreachable (${res.message})`);
        showToast('Endpoint unreachable', 'error');
      }
    } catch (err: any) {
      setEndpointTestResult(`Test failed: ${err.message}`);
      showToast('Health test failed', 'error');
    } finally {
      setIsTestingEndpoint(false);
    }
  };

  // 5. Apply Profile
  const handleApplyProfile = async (profileId: string) => {
    try {
      setIsActionLoading(true);
      await apiClient.applyProfile(profileId);
      showToast('Profile applied', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed applying profile', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'endpoint' | 'ip') => {
    navigator.clipboard.writeText(text);
    if (type === 'endpoint') {
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    } else {
      setCopiedIP(true);
      setTimeout(() => setCopiedIP(false), 2000);
    }
    showToast(`Copied ${type === 'endpoint' ? 'endpoint' : 'IP'} to clipboard`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Connection Hero Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem',
          position: 'relative',
          overflow: 'hidden',
          background: isConnected
            ? 'linear-gradient(145deg, rgba(16, 24, 40, 0.85) 0%, rgba(16, 185, 129, 0.08) 100%)'
            : 'linear-gradient(145deg, rgba(16, 24, 40, 0.85) 0%, rgba(239, 68, 68, 0.05) 100%)',
          borderColor: isConnected ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          {/* Status & Location Info */}
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isConnected ? 'var(--color-success)' : 'var(--text-muted)',
                boxShadow: isConnected ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none',
              }}
            >
              {isConnected ? <Shield size={36} /> : <ShieldAlert size={36} />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {isConnected
                    ? `${snapshot.country || 'Protected'} VPN`
                    : isTransitioning
                    ? 'Connecting to Tunnel...'
                    : 'VPN Disconnected'}
                </h2>
                <span
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                    color: isConnected ? 'var(--color-success)' : 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  {snapshot.state}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span>
                  Provider: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{snapshot.provider || 'ProtonVPN'}</strong>
                </span>
                <span>•</span>
                <span>
                  Protocol: <strong style={{ color: 'var(--text-primary)', textTransform: 'uppercase' }}>{snapshot.protocol || 'Wireguard'}</strong>
                </span>
                {snapshot.city && (
                  <>
                    <span>•</span>
                    <span>City: <strong style={{ color: 'var(--text-primary)' }}>{snapshot.city}</strong></span>
                  </>
                )}
                {snapshot.hostname && (
                  <>
                    <span>•</span>
                    <span className="font-mono">{snapshot.hostname}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isConnected ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsDisconnectModalOpen(true)}
                  disabled={isActionLoading || snapshot.operation_in_progress}
                  className="btn btn-danger"
                >
                  <Power size={16} />
                  Disconnect
                </button>
                <button
                  type="button"
                  onClick={() => setIsReconnectModalOpen(true)}
                  disabled={isActionLoading || snapshot.operation_in_progress}
                  className="btn btn-secondary"
                >
                  <RefreshCw size={16} />
                  Reconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={isActionLoading || snapshot.operation_in_progress}
                className="btn btn-primary"
              >
                <Zap size={16} />
                Connect Now
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('/servers')}
              className="btn btn-secondary"
            >
              <Globe size={16} />
              Switch Server
            </button>
          </div>
        </div>

        {/* Hero Footer Meta */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="var(--accent-indigo)" />
            <span>
              Tunnel Uptime:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {isConnected ? formatUptime(snapshot.uptime_seconds) : '0m'}
              </strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>Quick Profile:</span>
            <select
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.6rem',
                fontSize: '0.8rem',
              }}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleApplyProfile(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>
                Select Profile...
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.country || 'Global'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Quick-Stat Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Public IP Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Public VPN IP</span>
            <Globe size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {snapshot.public_ip?.public_ip || 'Unavailable'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            {snapshot.public_ip?.city ? `${snapshot.public_ip.city}, ` : ''}
            {snapshot.public_ip?.country || 'No location resolved'}
          </div>
        </div>

        {/* Forwarded Port Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Forwarded Port</span>
            <Radio size={18} color="var(--accent-indigo)" />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {isPortValid ? pf.port : 'Unavailable'}
          </div>
          <div style={{ fontSize: '0.75rem', color: isPortValid ? 'var(--color-success)' : 'var(--text-muted)', marginTop: '0.35rem' }}>
            {isPortValid ? 'Dynamic NAT-PMP Active' : 'Not assigned / Disabled'}
          </div>
        </div>

        {/* Download Speed Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Download Speed</span>
            <ArrowDown size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {snapshot.traffic.available ? formatRate(snapshot.traffic.download_rate) : 'Unavailable'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Total: {snapshot.traffic.available ? formatBytes(snapshot.traffic.total_download) : 'Unavailable'}
          </div>
        </div>

        {/* Upload Speed Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Upload Speed</span>
            <ArrowUp size={18} color="var(--accent-violet)" />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {snapshot.traffic.available ? formatRate(snapshot.traffic.upload_rate) : 'Unavailable'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Total: {snapshot.traffic.available ? formatBytes(snapshot.traffic.total_upload) : 'Unavailable'}
          </div>
        </div>

        {/* DNS Status Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>DNS Shield</span>
            <Shield size={18} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, textTransform: 'capitalize' }}>
            {snapshot.dns_status === 'running' ? 'Active Protected' : 'Degraded / Stopped'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Encrypted + DoT Active
          </div>
        </div>

        {/* Reconnections Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tunnel Health</span>
            <Activity size={18} color="var(--accent-indigo)" />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {isConnected ? 'Stable' : 'Offline'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Reconnections: {snapshot.reconnection_count}
          </div>
        </div>
      </div>

      {/* 3. Traffic Chart */}
      <TrafficChart traffic={snapshot.traffic} />

      {/* 4. Public Endpoint Card */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={18} color="var(--accent-indigo)" />
              Public Port-Forwarding Endpoint
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              External address for remote incoming traffic via ProtonVPN NAT-PMP
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={handleTestEndpoint}
              disabled={isTestingEndpoint || !isPortValid}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem' }}
            >
              <Activity size={15} />
              {isTestingEndpoint ? 'Testing...' : 'Test Reachability'}
            </button>
            <button
              type="button"
              onClick={() => setIsQRModalOpen(true)}
              disabled={!isPortValid}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem' }}
            >
              <QrCode size={15} />
              QR Code
            </button>
          </div>
        </div>

        {endpointTestResult && (
          <div
            style={{
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: endpointTestResult.startsWith('Reachable')
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              color: endpointTestResult.startsWith('Reachable') ? 'var(--color-success)' : 'var(--color-danger)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {endpointTestResult}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Complete Public Endpoint */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              COMPLETE PUBLIC ENDPOINT
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span className="font-mono" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                {isPortValid && snapshot.public_ip?.public_ip
                  ? `${snapshot.public_ip.public_ip}:${pf.port}`
                  : 'Unavailable'}
              </span>
              {isPortValid && snapshot.public_ip?.public_ip && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${snapshot.public_ip.public_ip}:${pf.port}`, 'endpoint')}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                  aria-label="Copy full endpoint"
                >
                  {copiedEndpoint ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* Forwarded Public Port */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              FORWARDED PORT
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-mono" style={{ fontSize: '1rem', fontWeight: 600 }}>
                {isPortValid ? pf.port : 'Unavailable'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Target App Port: <strong>{pf.internal_port || 8080}</strong>
              </span>
            </div>
          </div>

          {/* VPN Public IP */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              VPN PUBLIC IP
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span className="font-mono" style={{ fontSize: '1rem', fontWeight: 600 }}>
                {snapshot.public_ip?.public_ip || 'Unavailable'}
              </span>
              {snapshot.public_ip?.public_ip && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(snapshot.public_ip.public_ip || '', 'ip')}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                  aria-label="Copy IP"
                >
                  {copiedIP ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Modal */}
      <ConfirmModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect VPN Tunnel?"
        message="Disconnecting will stop your secure VPN connection and immediately engage Gluetun's engine kill switch, preventing any unprotected traffic from leaking."
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
        message="This will gracefully restart the tunnel connection. Ongoing network transfers may be temporarily interrupted for 2-5 seconds."
        confirmLabel="Reconnect"
        isLoading={isActionLoading}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        endpoint={isPortValid && snapshot.public_ip?.public_ip ? `${snapshot.public_ip.public_ip}:${pf.port}` : ''}
      />
    </div>
  );
};
