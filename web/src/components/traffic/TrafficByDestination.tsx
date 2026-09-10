import React, { useState } from 'react';
import { DestinationTrafficItem } from '../../types/vpn';
import { Globe, Search } from 'lucide-react';

interface TrafficByDestinationProps {
  destinations: DestinationTrafficItem[];
}

export const TrafficByDestination: React.FC<TrafficByDestinationProps> = ({ destinations }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = destinations.filter(
    (d) =>
      d.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ip.includes(searchTerm) ||
      d.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Live Destinations & CDNs
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Active egress endpoints routed through the encrypted tunnel
          </p>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search host, IP or CDN..."
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
      </div>

      {/* Destination Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>DESTINATION HOST</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>IP / PROTOCOL</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>CATEGORY</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>DOWN RATE</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>UP RATE</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem', textAlign: 'right' }}>FLOWS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <td style={{ padding: '0.65rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Globe size={14} color="var(--accent-cyan)" />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.destination}</span>
                  </div>
                </td>
                <td style={{ padding: '0.65rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {item.ip}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {item.protocol}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '0.65rem 0.75rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      color: 'var(--accent-indigo)',
                    }}
                  >
                    {item.category}
                  </span>
                </td>
                <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  ↓ {item.downloadRate}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-violet)' }}>
                  ↑ {item.uploadRate}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {item.connections}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
