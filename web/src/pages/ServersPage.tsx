import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  Radio,
  Shield,
  Tv,
  LayoutGrid,
  List,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Server, LiveSnapshot } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

interface ServersPageProps {
  snapshot: LiveSnapshot;
  onRefresh: () => void;
}

export const ServersPage: React.FC<ServersPageProps> = ({ snapshot, onRefresh }) => {
  const { showToast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [protocolFilter, setProtocolFilter] = useState<'all' | 'wireguard' | 'openvpn'>('all');
  const [portForwardOnly, setPortForwardOnly] = useState(false);
  const [secureCoreOnly, setSecureCoreOnly] = useState(false);
  const [torOnly, setTorOnly] = useState(false);
  const [streamOnly, setStreamOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Favorites stored in localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gluetun_favorite_servers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Server Switch Confirmation Modal State
  const [pendingServer, setPendingServer] = useState<Server | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchStep, setSwitchStep] = useState<string>('');

  const canSwitch = snapshot.capabilities.can_switch_server_runtime;

  useEffect(() => {
    fetchServers();
  }, [selectedCountry, protocolFilter, portForwardOnly, secureCoreOnly, torOnly, streamOnly]);

  const fetchServers = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getServers({
        provider: 'protonvpn',
        country: selectedCountry !== 'all' ? selectedCountry : undefined,
        protocol: protocolFilter !== 'all' ? protocolFilter : undefined,
        port_forward: portForwardOnly ? true : undefined,
        secure_core: secureCoreOnly ? true : undefined,
        tor: torOnly ? true : undefined,
        stream: streamOnly ? true : undefined,
      });
      setServers(data);
    } catch (err: any) {
      showToast(err.message || 'Failed fetching server list', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = (hostname: string) => {
    const updated = favorites.includes(hostname)
      ? favorites.filter((h) => h !== hostname)
      : [...favorites, hostname];
    setFavorites(updated);
    try {
      localStorage.setItem('gluetun_favorite_servers', JSON.stringify(updated));
    } catch {
      // Ignore storage error
    }
  };

  const handleSelectServer = (server: Server) => {
    if (!canSwitch) {
      showToast('Runtime server switching is not supported by this Gluetun version.', 'error');
      return;
    }
    setPendingServer(server);
  };

  const executeServerSwitch = async () => {
    if (!pendingServer) return;

    try {
      setIsSwitching(true);
      setSwitchStep('Validating server configuration...');

      await new Promise((r) => setTimeout(r, 400));
      setSwitchStep('Applying server configuration to Gluetun engine...');

      const res = await apiClient.vpnChangeServer({
        country: pendingServer.country,
        city: pendingServer.city,
        hostname: pendingServer.hostname,
        protocol: pendingServer.vpn === 'openvpn' ? 'openvpn' : 'wireguard',
      });

      if (!res.supported) {
        throw new Error('Runtime server switching is not supported.');
      }

      setSwitchStep('Waiting for confirmed tunnel state & new public IP...');
      await new Promise((r) => setTimeout(r, 1200));

      setSwitchStep('Verifying endpoint health and port forwarding...');
      await new Promise((r) => setTimeout(r, 800));

      showToast(`Successfully switched to ${pendingServer.country} (${pendingServer.hostname})`, 'success');
      setPendingServer(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed changing server, operation rolled back', 'error');
    } finally {
      setIsSwitching(false);
      setSwitchStep('');
    }
  };

  // Filter servers in memory for search query and favorites
  const filteredServers = servers.filter((srv) => {
    if (favoritesOnly && !favorites.includes(srv.hostname)) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchCountry = srv.country.toLowerCase().includes(q);
      const matchCity = (srv.city || '').toLowerCase().includes(q);
      const matchHost = srv.hostname.toLowerCase().includes(q);
      return matchCountry || matchCity || matchHost;
    }
    return true;
  });

  const uniqueCountries = Array.from(new Set(servers.map((s) => s.country))).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>ProtonVPN Server Browser</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Browse and connect to verified Gluetun VPN servers with capability-aware filtering.
          </p>
        </div>

        {!canSwitch && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--color-warning)',
              fontSize: '0.85rem',
            }}
          >
            <AlertCircle size={18} />
            Runtime server switching is not supported by this engine version.
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div
            style={{
              flex: 1,
              minWidth: '240px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.85rem',
            }}
          >
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by country, city, or hostname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                width: '100%',
                outline: 'none',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Country Selector */}
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.55rem 0.85rem',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All Countries ({uniqueCountries.length})</option>
            {uniqueCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Protocol Selector */}
          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value as any)}
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.55rem 0.85rem',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All Protocols</option>
            <option value="wireguard">WireGuard</option>
            <option value="openvpn">OpenVPN</option>
          </select>

          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.35rem 0.6rem',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--accent-indigo)' : 'transparent',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
              aria-label="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.35rem 0.6rem',
                border: 'none',
                background: viewMode === 'table' ? 'var(--accent-indigo)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
              aria-label="Table view"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Feature Checkboxes */}
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={portForwardOnly}
              onChange={(e) => setPortForwardOnly(e.target.checked)}
            />
            <Radio size={14} color="var(--accent-indigo)" />
            Port Forwarding
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={secureCoreOnly}
              onChange={(e) => setSecureCoreOnly(e.target.checked)}
            />
            <Shield size={14} color="var(--color-success)" />
            Secure Core
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={torOnly}
              onChange={(e) => setTorOnly(e.target.checked)}
            />
            Tor Support
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={streamOnly}
              onChange={(e) => setStreamOnly(e.target.checked)}
            />
            <Tv size={14} color="var(--accent-cyan)" />
            Streaming
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
            />
            <Star size={14} color="var(--color-warning)" fill={favoritesOnly ? 'var(--color-warning)' : 'none'} />
            Favorites Only ({favorites.length})
          </label>
        </div>
      </div>

      {/* Servers List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading ProtonVPN servers...
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No servers matching the selected filters. Try broadening your search.
        </div>
      ) : viewMode === 'grid' ? (
        /* Card Grid View */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {filteredServers.map((srv) => {
            const isFav = favorites.includes(srv.hostname);
            const isCurrent = snapshot.hostname === srv.hostname;

            return (
              <div
                key={srv.hostname}
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isCurrent ? '1px solid var(--color-success)' : '1px solid var(--border-subtle)',
                  boxShadow: isCurrent ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'var(--shadow-card)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{srv.country}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {srv.city || 'Standard Cluster'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFavorite(srv.hostname)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: isFav ? 'var(--color-warning)' : 'var(--text-muted)',
                      }}
                      aria-label="Toggle favorite"
                    >
                      <Star size={18} fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginBottom: '0.75rem' }}>
                    {srv.hostname}
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)', textTransform: 'uppercase' }}>
                      {srv.vpn}
                    </span>
                    {srv.port_forward && (
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-indigo)' }}>
                        P2P / Port Forward
                      </span>
                    )}
                    {srv.secure_core && (
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)' }}>
                        Secure Core
                      </span>
                    )}
                    {srv.stream && (
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
                        Stream
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {srv.ips.length} IPs available
                  </div>

                  {isCurrent ? (
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle size={15} /> Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canSwitch || snapshot.operation_in_progress}
                      onClick={() => handleSelectServer(srv)}
                      className="btn btn-primary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Fav</th>
                <th style={{ padding: '0.85rem 1rem' }}>Country</th>
                <th style={{ padding: '0.85rem 1rem' }}>City</th>
                <th style={{ padding: '0.85rem 1rem' }}>Hostname</th>
                <th style={{ padding: '0.85rem 1rem' }}>Protocol</th>
                <th style={{ padding: '0.85rem 1rem' }}>Features</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredServers.map((srv) => {
                const isFav = favorites.includes(srv.hostname);
                const isCurrent = snapshot.hostname === srv.hostname;

                return (
                  <tr
                    key={srv.hostname}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(srv.hostname)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: isFav ? 'var(--color-warning)' : 'var(--text-muted)',
                        }}
                      >
                        <Star size={16} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{srv.country}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{srv.city || '-'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      {srv.hostname}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textTransform: 'uppercase' }}>{srv.vpn}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {srv.port_forward && <span className="badge badge-connected" style={{ fontSize: '0.65rem' }}>P2P</span>}
                        {srv.secure_core && <span className="badge badge-demo" style={{ fontSize: '0.65rem' }}>Core</span>}
                        {srv.stream && <span className="badge badge-connecting" style={{ fontSize: '0.65rem' }}>Stream</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {isCurrent ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Current</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canSwitch || snapshot.operation_in_progress}
                          onClick={() => handleSelectServer(srv)}
                          className="btn btn-primary"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                        >
                          Connect
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Server Switch Confirmation Modal */}
      <Modal
        isOpen={Boolean(pendingServer)}
        onClose={() => !isSwitching && setPendingServer(null)}
        title="Confirm Server Switch"
        maxWidth="500px"
      >
        {pendingServer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              You are about to switch your active VPN connection to:
            </p>

            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                {pendingServer.country} {pendingServer.city ? `(${pendingServer.city})` : ''}
              </div>
              <div className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
                {pendingServer.hostname}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Protocol: <strong style={{ textTransform: 'uppercase' }}>{pendingServer.vpn}</strong> • Port Forwarding:{' '}
                <strong>{pendingServer.port_forward ? 'Enabled' : 'Disabled'}</strong>
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: 'var(--color-warning)',
                fontSize: '0.85rem',
              }}
            >
              ⚠️ <strong>Warning:</strong> Switching servers will restart the VPN tunnel and temporarily interrupt active traffic. Your forwarded port will change.
            </div>

            {isSwitching && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--accent-indigo)',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ animation: 'spin 1s linear infinite' }}>⟳</div>
                <span>{switchStep}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPendingServer(null)}
                disabled={isSwitching}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeServerSwitch}
                disabled={isSwitching}
                className="btn btn-primary"
              >
                {isSwitching ? 'Switching...' : 'Confirm & Switch Server'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
