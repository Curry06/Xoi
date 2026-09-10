import React, { useState } from 'react';
import { FirewallEvent } from '../../types/vpn';
import { Shield, ShieldAlert, ShieldCheck, Search, ArrowRight } from 'lucide-react';

interface FirewallViewProps {
  stats: {
    allowedCount: number;
    blockedCount: number;
    droppedCount: number;
    rulesCount: number;
  };
  events: FirewallEvent[];
  killSwitchActive: boolean;
}

export const FirewallView: React.FC<FirewallViewProps> = ({ stats, events, killSwitchActive }) => {
  const [actionFilter, setActionFilter] = useState<'ALL' | 'ALLOW' | 'BLOCK' | 'DROP'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = events.filter((e) => {
    const matchesAction = actionFilter === 'ALL' || e.action === actionFilter;
    const matchesSearch =
      e.source.includes(searchTerm) ||
      e.destination.includes(searchTerm) ||
      e.rule.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Firewall Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Kill Switch Status Card */}
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem',
            borderLeft: killSwitchActive ? '4px solid var(--color-success)' : '4px solid var(--color-danger)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>KILL SWITCH ENGINE</span>
            {killSwitchActive ? <ShieldCheck size={18} color="var(--color-success)" /> : <ShieldAlert size={18} color="var(--color-danger)" />}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: killSwitchActive ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {killSwitchActive ? 'STRICT DROP ENFORCED' : 'OFFLINE / DISABLED'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            iptables / nftables rules active
          </div>
        </div>

        {/* Packets Allowed */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>PACKETS ALLOWED</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
          </div>
          <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success)' }}>
            {stats.allowedCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Passed via encrypted tunnel
          </div>
        </div>

        {/* Packets Blocked */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>LEAKS BLOCKED</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
          </div>
          <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>
            {stats.blockedCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Prevented from unencrypted egress
          </div>
        </div>

        {/* Active Rules Count */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTIVE RULES</span>
            <Shield size={18} color="var(--accent-indigo)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
            {stats.rulesCount} Rules
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            INPUT, OUTPUT, FORWARD chains
          </div>
        </div>
      </div>

      {/* Live Firewall Event Stream */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Real-Time Firewall Event Stream</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Live packet decisions logged directly from netfilter inspection
            </p>
          </div>

          {/* Action Filter & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter IP or rule..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.35rem 0.6rem 0.35rem 2rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                padding: '2px',
              }}
            >
              {(['ALL', 'ALLOW', 'BLOCK', 'DROP'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActionFilter(filter)}
                  style={{
                    background: actionFilter === filter ? 'var(--accent-indigo)' : 'transparent',
                    color: actionFilter === filter ? '#ffffff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stream Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>TIMESTAMP</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>SOURCE</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}></th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>DESTINATION</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>PORT</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>MATCHING RULE</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    backgroundColor: e.action !== 'ALLOW' ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {e.timestamp}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {e.source}
                  </td>
                  <td style={{ padding: '0.65rem 0.25rem', color: 'var(--text-muted)' }}>
                    <ArrowRight size={13} />
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {e.destination}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                    {e.port}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {e.rule}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        backgroundColor:
                          e.action === 'ALLOW'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : e.action === 'BLOCK'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          e.action === 'ALLOW'
                            ? 'var(--color-success)'
                            : e.action === 'BLOCK'
                            ? 'var(--color-warning)'
                            : 'var(--color-danger)',
                        fontWeight: 700,
                      }}
                    >
                      {e.action}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
