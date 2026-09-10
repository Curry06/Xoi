import React, { useState } from 'react';
import { ScenarioID, DemoScenario } from '../../types/vpn';
import { Play, Sparkles, ChevronDown } from 'lucide-react';

interface ScenarioSimulatorBarProps {
  currentScenario: ScenarioID;
  onSelectScenario: (scenario: ScenarioID) => void;
  useLiveEngine: boolean;
  onToggleLiveEngine: (enabled: boolean) => void;
  isEngineOnline?: boolean;
}

export const ScenarioSimulatorBar: React.FC<ScenarioSimulatorBarProps> = ({
  currentScenario,
  onSelectScenario,
  useLiveEngine,
  onToggleLiveEngine,
  isEngineOnline = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const scenarios: DemoScenario[] = [
    {
      id: 'normal',
      title: '1. Normal Traffic Flow',
      subtitle: '24 Mbps • Low Latency (28ms) • Zurich',
      description: 'Standard nominal VPN operation with active encryption and steady packet flow.',
      badge: 'Baseline',
      color: '#10b981',
    },
    {
      id: 'large_download',
      title: '2. Heavy Download Surge',
      subtitle: '85+ Mbps • Fast particle velocity',
      description: 'High-speed download streaming showing maximum throughput and dynamic particle physics.',
      badge: 'Surge',
      color: '#06b6d4',
    },
    {
      id: 'vpn_latency',
      title: '3. Network Latency & Jitter',
      subtitle: '145ms RTT • Jitter spike • Warning HUD',
      description: 'Simulates trans-oceanic network congestion and degraded tunnel latency.',
      badge: 'Congestion',
      color: '#f59e0b',
    },
    {
      id: 'tunnel_disconnect',
      title: '4. Disconnect & Kill Switch',
      subtitle: 'Tunnel severed • Kill switch active',
      description: 'Simulates sudden tunnel termination with immediate firewall packet drop.',
      badge: 'Kill Switch',
      color: '#ef4444',
    },
    {
      id: 'vpn_reconnect',
      title: '5. Handshake Reconnection',
      subtitle: '6-stage state machine sequence',
      description: 'Animates the 6-stage negotiation: teardown, resolve, handshake, route, port forward, verify.',
      badge: 'Handshake',
      color: '#8b5cf6',
    },
    {
      id: 'dns_leak',
      title: '6. DNS Leak Intercept',
      subtitle: 'Unencrypted query caught & shielded',
      description: 'Demonstrates automated detection and blocking of rogue non-DoT queries.',
      badge: 'DNS Shield',
      color: '#f97316',
    },
    {
      id: 'public_ip_change',
      title: '7. IP Masking Transformation',
      subtitle: 'Physical ISP masked -> Tunnel Exit',
      description: 'Highlights anonymity transformation from physical origin to anonymous exit node.',
      badge: 'Anonymity',
      color: '#06b6d4',
    },
    {
      id: 'firewall_activity',
      title: '8. Firewall Port Attack Surge',
      subtitle: 'Brute-force scan • 120 drops/sec',
      description: 'Simulates inbound port scanning with iptables DROP rules triggering in real time.',
      badge: 'Security',
      color: '#ec4899',
    },
    {
      id: 'server_change',
      title: '9. Server Migration (Singapore)',
      subtitle: 'Seamless migration to SG-Singapore-08',
      description: 'Seamless tunnel failover and migration to an Asian gateway node.',
      badge: 'Migration',
      color: '#6366f1',
    },
    {
      id: 'multi_device',
      title: '10. Multi-Device Traffic Merging',
      subtitle: '5 LAN clients merged into tunnel',
      description: 'Merges multi-device LAN traffic (Laptop, Mobile, Home Server, Docker) into a single pipe.',
      badge: 'Multi-Client',
      color: '#14b8a6',
    },
  ];

  const activeScenarioObj = scenarios.find((s) => s.id === currentScenario);

  return (
    <div
      className="glass-panel"
      style={{
        padding: '0.85rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        background: 'linear-gradient(135deg, rgba(16, 24, 40, 0.9) 0%, rgba(99, 102, 241, 0.08) 100%)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Left: Mode Title & Scenario Selector Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Sparkles size={16} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-indigo)', letterSpacing: '0.05em' }}>
                SCENARIO SIMULATOR & CONTROL PLANE
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {useLiveEngine ? 'Live Engine Mode' : activeScenarioObj?.title || 'Scenario Simulation'}
              </strong>
              {!useLiveEngine && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  ({activeScenarioObj?.subtitle})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Controls & Live Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Live Engine Mode Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.3rem 0.6rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: isEngineOnline ? 'var(--color-success)' : 'var(--text-muted)' }} />
              Live Engine:
            </span>
            <button
              type="button"
              onClick={() => onToggleLiveEngine(!useLiveEngine)}
              style={{
                padding: '0.2rem 0.6rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: useLiveEngine ? 'var(--color-success)' : 'rgba(255, 255, 255, 0.1)',
                color: useLiveEngine ? '#090d16' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {useLiveEngine ? 'ACTIVE' : 'SIMULATE'}
            </button>
          </div>

          {/* Scenarios Dropdown Trigger */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', gap: '0.4rem' }}
          >
            <Play size={13} />
            <span>Select Scenario (1-10)</span>
            <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>
        </div>
      </div>

      {/* Expanded 10-Scenario Grid */}
      {isOpen && (
        <div
          style={{
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {scenarios.map((scen) => {
            const isSelected = !useLiveEngine && currentScenario === scen.id;
            return (
              <div
                key={scen.id}
                onClick={() => {
                  onSelectScenario(scen.id);
                  setIsOpen(false);
                }}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.825rem', color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                    {scen.title}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '3px',
                      backgroundColor: `${scen.color}22`,
                      color: scen.color,
                      fontWeight: 700,
                    }}
                  >
                    {scen.badge}
                  </span>
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  {scen.subtitle}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
