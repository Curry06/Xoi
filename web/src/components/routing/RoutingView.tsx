import React, { useState } from 'react';
import { RouteEntry } from '../../types/vpn';
import { Route, Search } from 'lucide-react';

interface RoutingViewProps {
  routes: RouteEntry[];
  interfaceName: string;
}

export const RoutingView: React.FC<RoutingViewProps> = ({ routes, interfaceName }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = routes.filter(
    (r) =>
      r.destination.includes(searchTerm) ||
      r.gateway.includes(searchTerm) ||
      r.interface.includes(searchTerm) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Visual Routing Architecture Diagram */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              color: 'var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Route size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Linux Kernel Routing Topology</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Deterministic kernel routing table (fib) ensuring no IP packets escape outside {interfaceName}
            </p>
          </div>
        </div>

        {/* Visual Route Pipeline Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Default Route Card */}
          <div
            style={{
              padding: '1.1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                DEFAULT INTERNET ROUTE
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(6, 182, 212, 0.2)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 700,
                }}
              >
                tun0
              </span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              0.0.0.0/0
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              <span>via</span>
              <strong className="font-mono" style={{ color: 'var(--accent-cyan)' }}>10.2.0.1</strong>
              <span>(dev {interfaceName})</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              All global application and web traffic is encrypted and forced through the VPN tunnel.
            </div>
          </div>

          {/* Local LAN Route */}
          <div
            style={{
              padding: '1.1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                LAN BYPASS ROUTE
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                eth0
              </span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              192.168.1.0/24
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              <span>via</span>
              <strong className="font-mono">0.0.0.0</strong>
              <span>(dev eth0 direct)</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Local subnet communications (NAS, printers, LAN control) bypass encryption.
            </div>
          </div>

          {/* Underlay VPN Endpoint Route */}
          <div
            style={{
              padding: '1.1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                VPN SERVER UNDERLAY
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: 'var(--accent-indigo)',
                  fontWeight: 700,
                }}
              >
                eth0
              </span>
            </div>
            <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              185.156.174.45/32
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              <span>via</span>
              <strong className="font-mono">192.168.1.1</strong>
              <span>(dev eth0)</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Host route specifically for establishing the encrypted tunnel socket to the remote server.
            </div>
          </div>
        </div>
      </div>

      {/* Kernel Route Table */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Kernel Routing Table (ip route)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Live Forwarding Information Base (FIB) entries
            </p>
          </div>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search route or CIDR..."
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

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>DESTINATION (CIDR)</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>GATEWAY</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>INTERFACE</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>FLAGS</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>METRIC</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.destination}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {r.gateway}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: r.interface.startsWith('tun') || r.interface.startsWith('wg')
                          ? 'rgba(6, 182, 212, 0.15)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: r.interface.startsWith('tun') || r.interface.startsWith('wg')
                          ? 'var(--accent-cyan)'
                          : 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                      }}
                    >
                      {r.interface}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {r.flags}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {r.metric}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {r.description}
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
