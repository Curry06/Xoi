import React from 'react';
import { AppTrafficItem } from '../../types/vpn';
import { Globe, Box, Terminal, Film, HardDrive, Shield } from 'lucide-react';

interface TrafficByAppProps {
  items: AppTrafficItem[];
  totalMbps: number;
}

export const TrafficByApp: React.FC<TrafficByAppProps> = ({ items, totalMbps }) => {
  const getAppIcon = (name: string) => {
    if (name.includes('Browser')) return <Globe size={16} />;
    if (name.includes('Docker')) return <Box size={16} />;
    if (name.includes('Git') || name.includes('CLI')) return <Terminal size={16} />;
    if (name.includes('Stream') || name.includes('Media')) return <Film size={16} />;
    if (name.includes('Torrent') || name.includes('P2P')) return <HardDrive size={16} />;
    return <Shield size={16} />;
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Traffic by Application
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time process breakdown ({totalMbps.toFixed(1)} Mbps total tunnel bandwidth)
          </p>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            color: 'var(--accent-indigo)',
            fontWeight: 600,
          }}
        >
          {items.length} Active Apps
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
        {items.map((item) => (
          <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: item.color }}>{getAppIcon(item.name)}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({item.category})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {item.rateMbps.toFixed(2)} Mbps
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '38px', textAlign: 'right' }}>
                  {item.percentage}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              style={{
                height: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                  height: '100%',
                  backgroundColor: item.color,
                  borderRadius: '3px',
                  transition: 'width 0.4s ease',
                  boxShadow: `0 0 8px ${item.color}88`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
