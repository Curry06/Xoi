import React, { useState } from 'react';
import { ActiveConnection } from '../../types/vpn';
import { Layers, Search, ArrowRight } from 'lucide-react';

interface ActiveConnectionsViewProps {
  connections: ActiveConnection[];
}

export const ActiveConnectionsView: React.FC<ActiveConnectionsViewProps> = ({ connections }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');

  const filtered = connections.filter((conn) => {
    const matchesSearch =
      conn.source.includes(searchTerm) ||
      conn.destination.includes(searchTerm) ||
      conn.port.toString().includes(searchTerm);

    const matchesProtocol = protocolFilter === 'ALL' || conn.protocol === protocolFilter;
    const matchesState = stateFilter === 'ALL' || conn.state === stateFilter;

    return matchesSearch && matchesProtocol && matchesState;
  });

  const establishedCount = connections.filter((c) => c.state === 'ESTABLISHED').length;
  const blockedCount = connections.filter((c) => c.action === 'BLOCKED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top summary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            TOTAL TRACKED FLOWS
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {connections.length}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            ESTABLISHED (ESTAB)
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
            {establishedCount}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            BLOCKED / DROPPED
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-danger)' }}>
            {blockedCount}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            CONNTRACK STATUS
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
            Kernel NAT State OK
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Controls bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-indigo)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Active Socket Connections</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Direct conntrack inspection of routed TCP/UDP flows
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter IP or port..."
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

            {/* Protocol Filter */}
            <select
              value={protocolFilter}
              onChange={(e) => setProtocolFilter(e.target.value)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.35rem 0.6rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            >
              <option value="ALL">All Protocols</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="HTTPS">HTTPS</option>
              <option value="DNS">DNS</option>
            </select>

            {/* State Filter */}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.35rem 0.6rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            >
              <option value="ALL">All States</option>
              <option value="ESTABLISHED">Established</option>
              <option value="SYN_SENT">SYN_SENT</option>
              <option value="TIME_WAIT">TIME_WAIT</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>SOURCE</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}></th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>DESTINATION</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>PORT</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>PROTO</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>STATE</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>TRAFFIC</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>DURATION</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    backgroundColor: c.action === 'BLOCKED' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {c.source}
                  </td>
                  <td style={{ padding: '0.65rem 0.25rem', color: 'var(--text-muted)' }}>
                    <ArrowRight size={13} />
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.destination}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                    {c.port}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {c.protocol}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color:
                          c.state === 'ESTABLISHED'
                            ? 'var(--color-success)'
                            : c.state === 'BLOCKED'
                            ? 'var(--color-danger)'
                            : 'var(--color-warning)',
                      }}
                    >
                      {c.state}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {c.traffic}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {c.duration}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                    {c.action === 'ALLOWED' ? (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: 'var(--color-success)',
                          fontWeight: 700,
                        }}
                      >
                        ALLOWED
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: 'var(--color-danger)',
                          fontWeight: 700,
                        }}
                      >
                        KILL-SWITCH BLOCKED
                      </span>
                    )}
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
