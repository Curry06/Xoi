import React, { useState } from 'react';
import {
  Radio,
  Activity,
  QrCode,
  Copy,
  Check,
  Clock,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { LiveSnapshot, HistoryEvent } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../components/Toast';
import { QRCodeModal } from '../components/QRCodeModal';

interface PortForwardingPageProps {
  snapshot: LiveSnapshot;
  historyEvents: HistoryEvent[];
}

export const PortForwardingPage: React.FC<PortForwardingPageProps> = ({ snapshot, historyEvents }) => {
  const { showToast } = useToast();
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ reachable: boolean; message: string } | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedURL, setCopiedURL] = useState(false);

  const pf = snapshot.port_forwarding;
  const isPortValid = pf && pf.port > 0 && pf.port <= 65535;
  const publicIP = snapshot.public_ip?.public_ip;
  const fullEndpoint = isPortValid && publicIP ? `${publicIP}:${pf.port}` : '';
  const fullURL = isPortValid && publicIP ? `http://${publicIP}:${pf.port}` : '';

  const portHistory = historyEvents.filter((e) => e.type === 'port_change');

  const handleTestReachability = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await apiClient.testEndpoint();
      setTestResult({ reachable: res.reachable, message: res.message });
      if (res.reachable) {
        showToast('Port is publicly accessible!', 'success');
      } else {
        showToast('Port is not accessible: ' + res.message, 'error');
      }
    } catch (err: any) {
      setTestResult({ reachable: false, message: err.message });
      showToast('Health test failed', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string, type: 'endpoint' | 'url') => {
    navigator.clipboard.writeText(text);
    if (type === 'endpoint') {
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    } else {
      setCopiedURL(true);
      setTimeout(() => setCopiedURL(false), 2000);
    }
    showToast(`Copied ${type === 'endpoint' ? 'endpoint' : 'URL'} to clipboard`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Port Forwarding & NAT-PMP</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Real-time dynamic port allocation managed natively by Gluetun's NAT-PMP engine.
        </p>
      </div>

      {/* Dynamic Port Notice Alert */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        <Info size={20} color="var(--accent-indigo)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Important Note:</strong> ProtonVPN assigns{' '}
          <em>dynamic public ports</em> that renew every 45–60 seconds via NAT-PMP. Assigned ports are not static and may change upon reconnecting or server switching.
        </div>
      </div>

      {/* Primary Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {/* Current Allocation Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={18} color="var(--accent-indigo)" />
              Assigned Public Port
            </h3>
            <span className={isPortValid ? 'badge badge-connected' : 'badge badge-disconnected'}>
              {isPortValid ? 'Active Lease' : 'Unavailable'}
            </span>
          </div>

          <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
            <div
              className="font-mono"
              style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: isPortValid ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}
            >
              {isPortValid ? pf.port : 'None'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {isPortValid
                ? `Mapped to internal container port ${pf.internal_port || 8080}`
                : 'No forwarded port allocated by VPN provider'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleTestReachability}
              disabled={isTesting || !isPortValid}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              <Activity size={16} />
              {isTesting ? 'Testing...' : 'Test Port Reachability'}
            </button>
            <button
              type="button"
              onClick={() => setIsQRModalOpen(true)}
              disabled={!isPortValid}
              className="btn btn-secondary"
            >
              <QrCode size={16} />
            </button>
          </div>

          {testResult && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: testResult.reachable ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: testResult.reachable ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: '0.85rem',
                textAlign: 'center',
              }}
            >
              {testResult.message}
            </div>
          )}
        </div>

        {/* Public Endpoint Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="var(--color-success)" />
            External Network Endpoint
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'center' }}>
            {/* Host & Port Row */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                FULL PUBLIC ENDPOINT (HOST:PORT)
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span className="font-mono" style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>
                  {fullEndpoint || 'Unavailable'}
                </span>
                {fullEndpoint && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fullEndpoint, 'endpoint')}
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    {copiedEndpoint ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>

            {/* Complete URL Row */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                COMPLETE HTTP URL
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {fullURL || 'Unavailable'}
                </span>
                {fullURL && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fullURL, 'url')}
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    {copiedURL ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Protocol: <strong>NAT-PMP</strong> • Status: <strong>{isPortValid ? 'Listening' : 'Inactive'}</strong>
          </div>
        </div>
      </div>

      {/* Port Allocation History Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="var(--accent-indigo)" />
          Port Allocation History
        </h3>

        {portHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No recent port changes recorded in this session.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Timestamp</th>
                  <th style={{ padding: '0.75rem' }}>Event</th>
                  <th style={{ padding: '0.75rem' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {portHistory.map((event) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{event.title}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{event.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        endpoint={fullEndpoint}
      />
    </div>
  );
};
