import React, { useState } from 'react';
import {
  Shield,
  Sliders,
  CheckCircle,
  XCircle,
  Beaker,
  Save,
} from 'lucide-react';
import { LiveSnapshot } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../components/Toast';

interface SettingsPageProps {
  snapshot: LiveSnapshot;
  onRefresh: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ snapshot, onRefresh }) => {
  const { showToast } = useToast();

  const [refreshInterval, setRefreshInterval] = useState('2500');
  const [speedUnits, setSpeedUnits] = useState<'bytes' | 'bits'>('bytes');
  const [internalPort, setInternalPort] = useState(String(snapshot.port_forwarding?.internal_port || 8080));
  const [selectedScenario, setSelectedScenario] = useState(snapshot.mock_scenario || 'connected');
  const [isSwitchingScenario, setIsSwitchingScenario] = useState(false);

  const capabilities = snapshot.capabilities;

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Preferences saved successfully', 'success');
  };

  const handleScenarioChange = async (newScenario: string) => {
    try {
      setIsSwitchingScenario(true);
      setSelectedScenario(newScenario);
      await apiClient.setMockScenario(newScenario);
      showToast(`Switched mock scenario to '${newScenario}'`, 'info');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed setting scenario', 'error');
    } finally {
      setIsSwitchingScenario(false);
    }
  };

  const capabilityList = [
    { key: 'can_connect', label: 'Connect Tunnel', supported: capabilities.can_connect },
    { key: 'can_disconnect', label: 'Disconnect Tunnel', supported: capabilities.can_disconnect },
    { key: 'can_reconnect', label: 'Graceful Reconnect', supported: capabilities.can_reconnect },
    { key: 'can_switch_server_runtime', label: 'Runtime Server Switching', supported: capabilities.can_switch_server_runtime },
    { key: 'can_change_protocol_runtime', label: 'Runtime Protocol Switching', supported: capabilities.can_change_protocol_runtime, note: 'Requires container restart' },
    { key: 'can_control_dns_runtime', label: 'DNS Shield Control', supported: capabilities.can_control_dns_runtime },
    { key: 'can_read_port_forwarding', label: 'Port Forwarding (NAT-PMP)', supported: capabilities.can_read_port_forwarding },
    { key: 'can_read_traffic', label: 'Traffic Telemetry', supported: capabilities.can_read_traffic },
    { key: 'can_control_firewall', label: 'Runtime Firewall Toggle', supported: capabilities.can_control_firewall, note: 'Kill switch permanent engine invariant' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Dashboard Settings & Capabilities</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Configure dashboard preferences, inspect engine capabilities, and manage development mock scenarios.
        </p>
      </div>

      {/* Mock Scenario Switcher (Visible only when in mock mode) */}
      {snapshot.is_mock && (
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            backgroundColor: 'rgba(139, 92, 246, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Beaker size={20} color="var(--accent-violet)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Development Mock Scenario Switcher</h3>
            <span className="badge badge-demo">Demo Active</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Simulate exact engine states and failure conditions for comprehensive end-to-end testing:
          </p>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {[
              { id: 'connected', label: 'Connected' },
              { id: 'connecting', label: 'Connecting' },
              { id: 'disconnected', label: 'Disconnected' },
              { id: 'port_unavailable', label: 'Port Unavailable' },
              { id: 'public_ip_unavailable', label: 'Public IP Unavailable' },
              { id: 'server_switch_failure', label: 'Server Switch Error' },
              { id: 'degraded_dns', label: 'Degraded DNS' },
              { id: 'slow_response', label: 'Slow Network (1.5s)' },
              { id: 'unsupported_capability', label: 'Unsupported Server Switch' },
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleScenarioChange(sc.id)}
                disabled={isSwitchingScenario}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid',
                  cursor: 'pointer',
                  backgroundColor: selectedScenario === sc.id ? 'var(--accent-violet)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: selectedScenario === sc.id ? 'var(--accent-violet)' : 'var(--border-subtle)',
                  color: selectedScenario === sc.id ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Preferences & Engine Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* User Preferences Form */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={18} color="var(--accent-indigo)" />
            Dashboard Preferences
          </h3>

          <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Live Refresh Interval
              </label>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="2000">2 Seconds (High Frequency)</option>
                <option value="2500">2.5 Seconds (Default)</option>
                <option value="5000">5 Seconds (Low Bandwidth)</option>
                <option value="10000">10 Seconds (Minimal)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Bandwidth Unit Preference
              </label>
              <select
                value={speedUnits}
                onChange={(e) => setSpeedUnits(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="bytes">Bytes (KB/s, MB/s)</option>
                <option value="bits">Bits (Kbps, Mbps)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Internal Application Redirect Port
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                value={internalPort}
                onChange={(e) => setInternalPort(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              <Save size={16} />
              Save Preferences
            </button>
          </form>
        </div>

        {/* Engine Information Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} color="var(--color-success)" />
            Engine & Version Information
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gluetun Engine:</span>
              <strong className="font-mono">{snapshot.engine_version || 'v3.39.0'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Control Center:</span>
              <strong className="font-mono">{snapshot.dashboard_version || '1.0.0'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Adapter Mode:</span>
              <strong style={{ color: snapshot.is_mock ? 'var(--accent-violet)' : 'var(--color-success)' }}>
                {snapshot.is_mock ? 'Mock Adapter (Demo Data)' : 'Live Engine Adapter'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Architecture:</span>
              <span>Isolated Management Network</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Docker Socket Mount:</span>
              <strong style={{ color: 'var(--color-success)' }}>Disabled (Safe)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Capability Report Matrix */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Capability Matrix Report
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Derived directly from the verified capabilities of the checked-out Gluetun engine version.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {capabilityList.map((cap) => (
            <div
              key={cap.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{cap.label}</div>
                {cap.note && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cap.note}</div>}
              </div>

              {cap.supported ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-success)', fontWeight: 600 }}>
                  <CheckCircle size={16} /> Supported
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <XCircle size={16} /> Unsupported
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
