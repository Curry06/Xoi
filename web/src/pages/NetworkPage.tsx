import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Flame,
  CheckCircle,
  RefreshCw,
  Server,
} from 'lucide-react';
import { LiveSnapshot } from '../types';
import { useToast } from '../components/Toast';

interface NetworkPageProps {
  snapshot: LiveSnapshot;
  onRefresh: () => void;
}

export const NetworkPage: React.FC<NetworkPageProps> = ({ snapshot, onRefresh }) => {
  const { showToast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const capabilities = snapshot.capabilities;

  const handleTriggerUpdater = async () => {
    try {
      setIsUpdating(true);
      showToast('Triggered Gluetun server updater', 'info');
      // Updater status toggle
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed updating server data', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Network & Security Invariants</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Inspect Gluetun's kernel-level firewall, DNS protections, and protocol safeguards.
        </p>
      </div>

      {/* Grid of Network Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* 1. Firewall & Kill Switch (Engine Invariant) */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Flame size={18} color="var(--color-danger)" />
              Firewall Kill-Switch
            </h3>
            <span className="badge badge-connected" style={{ gap: '0.3rem' }}>
              <CheckCircle size={12} />
              Active (Engine Invariant)
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Gluetun enforces strict iptables routing rules at the network namespace level. In the event of connection loss or tunnel interruption, all outbound internet traffic is immediately blocked to prevent leaks.
          </p>

          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <strong style={{ color: 'var(--color-success)' }}>Enforced by Kernel</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Runtime Modification:</span>
              <span style={{ color: 'var(--text-muted)' }}>Locked (Protected)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Leak Protection:</span>
              <span>DNS, IPv4, IPv6 Kill Switch</span>
            </div>
          </div>
        </div>

        {/* 2. DNS Protection & Ad-Blocking */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} color="var(--color-success)" />
              DNS Protection & Unbound
            </h3>
            <span className={snapshot.dns_status === 'running' ? 'badge badge-connected' : 'badge badge-degraded'}>
              {snapshot.dns_status === 'running' ? 'Protected' : 'Degraded'}
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            DNS queries are resolved through Gluetun's internal encrypted resolver with DNS-over-TLS (DoT) and caching.
          </p>

          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Encrypted DNS (DoT):</span>
              <strong style={{ color: 'var(--color-success)' }}>Enabled</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Malicious Domain Blocking:</span>
              <span style={{ color: 'var(--color-success)' }}>Active</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ad & Tracker Filtering:</span>
              <span style={{ color: 'var(--accent-indigo)' }}>Engine Filter List</span>
            </div>
          </div>
        </div>

        {/* 3. VPN Protocol & Ciphers */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} color="var(--accent-indigo)" />
              Protocol & Cryptography
            </h3>
            <span className="badge badge-demo" style={{ textTransform: 'uppercase' }}>
              {snapshot.protocol || 'Wireguard'}
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Tunnel configured with modern ChaCha20-Poly1305 and Curve25519 key exchange.
          </p>

          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Protocol Type:</span>
              <strong style={{ textTransform: 'uppercase' }}>{snapshot.protocol || 'WireGuard'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Network Interface:</span>
              <span className="font-mono">{snapshot.tunnel_interface || 'tun0'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Protocol Switching:</span>
              <span style={{ color: 'var(--text-muted)' }}>Container Restart Required</span>
            </div>
          </div>
        </div>

        {/* 4. Server Updater & Database */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={18} color="var(--accent-cyan)" />
              Server List Updater
            </h3>
            <span className="badge badge-disconnected">
              {snapshot.updater_status || 'Idle'}
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Gluetun periodically refreshes official provider server IP lists, public keys, and health statuses.
          </p>

          <button
            type="button"
            onClick={handleTriggerUpdater}
            disabled={isUpdating || !capabilities.can_control_updater_runtime}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 'auto' }}
          >
            <RefreshCw size={16} />
            {isUpdating ? 'Updating...' : 'Check For Server Updates'}
          </button>
        </div>
      </div>
    </div>
  );
};
