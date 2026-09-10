import React, { useState } from 'react';
import { Server, Radio, Copy, Check } from 'lucide-react';
import { VPNSettings, TunnelState } from '../../types/vpn';

interface VPNServerCardProps {
  settings: VPNSettings;
  state: TunnelState;
  latencyMs: number;
  onSwitchServer: (serverName: string, country: string, ip: string) => void;
}

export const VPNServerCard: React.FC<VPNServerCardProps> = ({
  settings,
  state,
  latencyMs,
  onSwitchServer,
}) => {
  const [isChangingServer, setIsChangingServer] = useState(false);
  const [copiedPort, setCopiedPort] = useState(false);

  const isConnected = state === 'connected';

  const availableServers = [
    { name: 'CH-Zurich-04', country: 'Switzerland', city: 'Zurich', ip: '185.156.174.45', load: 42, ping: 28 },
    { name: 'NL-Amsterdam-12', country: 'Netherlands', city: 'Amsterdam', ip: '194.126.177.10', load: 68, ping: 35 },
    { name: 'SE-Stockholm-02', country: 'Sweden', city: 'Stockholm', ip: '185.213.155.8', load: 31, ping: 42 },
    { name: 'SG-Singapore-08', country: 'Singapore', city: 'Singapore', ip: '103.149.162.2', load: 55, ping: 165 },
    { name: 'US-NewYork-22', country: 'United States', city: 'New York', ip: '198.54.133.15', load: 78, ping: 88 },
    { name: 'JP-Tokyo-05', country: 'Japan', city: 'Tokyo', ip: '138.199.35.6', load: 49, ping: 195 },
  ];

  const copyPort = () => {
    navigator.clipboard.writeText(`${settings.publicIP}:${settings.portForwarded}`);
    setCopiedPort(true);
    setTimeout(() => setCopiedPort(false), 2000);
  };

  const getLoadColor = (load: number) => {
    if (load < 50) return 'var(--color-success)';
    if (load < 80) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Title & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--accent-indigo)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Server size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Connected Gateway & Node
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Target egress server infrastructure and NAT-PMP endpoint
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsChangingServer(!isChangingServer)}
          className="btn btn-secondary"
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
        >
          {isChangingServer ? 'Close List' : 'Change Gateway'}
        </button>
      </div>

      {/* Server Quick Selector Drawer */}
      {isChangingServer && (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            SELECT ROUTED VPN GATEWAY:
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.5rem',
            }}
          >
            {availableServers.map((srv) => {
              const isSelected = settings.serverName === srv.name;
              return (
                <div
                  key={srv.name}
                  onClick={() => {
                    onSwitchServer(srv.name, srv.country, srv.ip);
                    setIsChangingServer(false);
                  }}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{srv.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{srv.ping}ms</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {srv.city}, {srv.country}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <div
                      style={{
                        flex: 1,
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${srv.load}%`,
                          height: '100%',
                          backgroundColor: getLoadColor(srv.load),
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{srv.load}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Server Details Card Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Node Location */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            EGRESS SERVER & LOCATION
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {settings.serverName}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {settings.serverCity}, {settings.serverCountry}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
            Gateway IP: {settings.serverIP}
          </div>
        </div>

        {/* Server Load & Capacity */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SERVER CAPACITY & LOAD</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: getLoadColor(settings.serverLoadPercent) }}>
              {settings.serverLoadPercent}%
            </span>
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
              margin: '0.5rem 0',
            }}
          >
            <div
              style={{
                width: `${settings.serverLoadPercent}%`,
                height: '100%',
                backgroundColor: getLoadColor(settings.serverLoadPercent),
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Ping: {latencyMs} ms</span>
            <span>Capacity: 10 Gbps Port</span>
          </div>
        </div>

        {/* Port Forwarding NAT-PMP */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NAT-PMP PORT FORWARDING</span>
            <Radio size={15} color="var(--accent-indigo)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              {isConnected ? settings.portForwarded : 'Disabled'}
            </span>
            {isConnected && (
              <button
                type="button"
                onClick={copyPort}
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              >
                {copiedPort ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                {copiedPort ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Internal target port: <strong>{settings.internalPort}</strong> (Loopback)
          </div>
        </div>
      </div>
    </div>
  );
};
