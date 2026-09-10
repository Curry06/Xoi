import React from 'react';
import { DeviceTrafficItem } from '../../types/vpn';
import { Laptop, Smartphone, Server, Box, Radio } from 'lucide-react';

interface DevicesViewProps {
  devices: DeviceTrafficItem[];
}

export const DevicesView: React.FC<DevicesViewProps> = ({ devices }) => {
  const totalDown = devices.reduce((sum, d) => sum + d.downloadMbps, 0);
  const totalUp = devices.reduce((sum, d) => sum + d.uploadMbps, 0);
  const totalConns = devices.reduce((sum, d) => sum + d.connections, 0);

  const getDeviceIcon = (type: DeviceTrafficItem['type']) => {
    switch (type) {
      case 'laptop':
        return <Laptop size={18} color="var(--accent-indigo)" />;
      case 'mobile':
        return <Smartphone size={18} color="var(--accent-cyan)" />;
      case 'server':
        return <Server size={18} color="var(--color-success)" />;
      case 'docker':
        return <Box size={18} color="var(--accent-violet)" />;
      case 'iot':
      default:
        return <Radio size={18} color="var(--color-warning)" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Aggregate Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            TOTAL ROUTED CLIENTS
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {devices.length} Devices
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
            All traffic encrypted via tun0
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            AGGREGATE INGRESS
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            {totalDown.toFixed(1)} Mbps
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Merged tunnel download
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            AGGREGATE EGRESS
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-violet)' }}>
            {totalUp.toFixed(1)} Mbps
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Merged tunnel upload
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            COMBINED FLOWS
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {totalConns} Sockets
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            NAT conntrack entries
          </div>
        </div>
      </div>

      {/* Devices List Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Local Network Clients (LAN Gateway)</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Devices routing their traffic through this container gateway into the encrypted tunnel
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {devices.map((dev) => {
            const sharePercent = totalDown > 0 ? Math.round((dev.downloadMbps / totalDown) * 100) : 0;
            return (
              <div
                key={dev.id}
                style={{
                  padding: '1.1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getDeviceIcon(dev.type)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {dev.name}
                      </div>
                      <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {dev.ip}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--color-success)',
                      fontWeight: 700,
                    }}
                  >
                    ROUTED
                  </span>
                </div>

                {/* Rates */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    ↓ {dev.downloadMbps.toFixed(1)} Mbps
                  </span>
                  <span style={{ color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)' }}>
                    ↑ {dev.uploadMbps.toFixed(1)} Mbps
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {dev.connections} conns
                  </span>
                </div>

                {/* Share bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    <span>Bandwidth Share</span>
                    <span>{sharePercent}%</span>
                  </div>
                  <div
                    style={{
                      height: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${sharePercent}%`,
                        height: '100%',
                        backgroundColor: 'var(--accent-indigo)',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
