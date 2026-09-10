import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  HardDrive,
  Plus,
  Radio,
  Layers,
  Search,
  ExternalLink,
  Power,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { LiveSnapshot, ProxyRoute, RouteMetrics, PublicEndpoint, ProxyStatus } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../components/Toast';
import { AddApplicationModal } from '../components/proxy/AddApplicationModal';
import { ApplicationDetailsModal } from '../components/proxy/ApplicationDetailsModal';

interface PublicApplicationsPageProps {
  snapshot: LiveSnapshot;
  onRefresh: () => void;
}

export const PublicApplicationsPage: React.FC<PublicApplicationsPageProps> = ({ snapshot }) => {
  const { showToast } = useToast();

  const [routes, setRoutes] = useState<ProxyRoute[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, RouteMetrics>>({});
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [publicEndpoint, setPublicEndpoint] = useState<PublicEndpoint | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ProxyRoute | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<ProxyRoute | null>(null);

  const fetchProxyData = useCallback(async () => {
    try {
      const [r, m, s, ep] = await Promise.all([
        apiClient.getProxyRoutes().catch(() => []),
        apiClient.getProxyMetrics().catch(() => ({})),
        apiClient.getProxyStatus().catch(() => null),
        apiClient.getPublicEndpoint().catch(() => null),
      ]);
      setRoutes(r);
      setMetricsMap(m);
      setProxyStatus(s);
      setPublicEndpoint(ep);
    } catch (err: any) {
      console.error('Failed fetching proxy data', err);
    }
  }, []);

  useEffect(() => {
    fetchProxyData();
    const interval = setInterval(fetchProxyData, 4000);
    return () => clearInterval(interval);
  }, [fetchProxyData]);

  const handleToggleEnable = async (route: ProxyRoute) => {
    try {
      if (route.enabled) {
        await apiClient.disableProxyRoute(route.id);
        showToast(`Route '${route.name}' disabled`, 'info');
      } else {
        await apiClient.enableProxyRoute(route.id);
        showToast(`Route '${route.name}' enabled`, 'success');
      }
      fetchProxyData();
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    }
  };

  const handleDeleteRoute = async (route: ProxyRoute) => {
    if (!window.confirm(`Are you sure you want to delete '${route.name}'?`)) {
      return;
    }
    try {
      await apiClient.deleteProxyRoute(route.id);
      showToast(`Route '${route.name}' deleted`, 'info');
      fetchProxyData();
    } catch (err: any) {
      showToast(err.message || 'Failed deleting route', 'error');
    }
  };

  const filteredRoutes = routes.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.domain && r.domain.toLowerCase().includes(q)) ||
      (r.path && r.path.toLowerCase().includes(q)) ||
      `${r.target_host}:${r.target_port}`.includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={12} /> Active
          </span>
        );
      case 'DISABLED':
        return (
          <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            Disabled
          </span>
        );
      case 'TARGET_UNREACHABLE':
        return (
          <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <XCircle size={12} /> Unreachable
          </span>
        );
      case 'UNHEALTHY':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <AlertTriangle size={12} /> Unhealthy
          </span>
        );
      default:
        return <span className="badge badge-muted">{status}</span>;
    }
  };

  const activePort = snapshot.port_forwarding?.port || publicEndpoint?.forwarded_port || 0;
  const activeIP = snapshot.public_ip?.public_ip || publicEndpoint?.public_ip || 'Pending';
  const internalIngressPort = publicEndpoint?.internal_port || proxyStatus?.public_endpoint.internal_port || 8080;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Globe size={24} color="var(--accent-indigo)" />
            Public Applications
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Expose and manage multiple web applications dynamically through a single Proton VPN tunnel and forwarded port.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchProxyData}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingRoute(null);
              setIsAddModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            Add Application
          </button>
        </div>
      </div>

      {/* Hero: VPN Public Ingress Endpoint Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(6, 182, 212, 0.04) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Radio size={20} color="var(--accent-indigo)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Active Proton VPN Ingress Endpoint</h3>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="badge badge-online">
              VPN {snapshot.state.toUpperCase()}
            </span>
            <span className={`badge ${proxyStatus?.engine_running ? 'badge-online' : 'badge-demo'}`}>
              Caddy Reverse Proxy {proxyStatus?.engine_running ? 'Running' : 'Ready'}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Proton VPN Public IP</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {activeIP}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {snapshot.public_ip?.country || 'Connected Server'}
            </div>
          </div>

          <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Forwarded Proton Port</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-success)', marginTop: '0.2rem' }}>
              {activePort > 0 ? activePort : 'Allocating...'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              NAT-PMP Tunnel Ingress
            </div>
          </div>

          <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Internal Ingress Redirect</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
              :{internalIngressPort}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              iptables PREROUTING Target
            </div>
          </div>

          <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dynamic App Routes</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {routes.length} Configured
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {routes.filter((r) => r.enabled).length} Enabled
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search applications, domains, targets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem 0.55rem 2.4rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>
      </div>

      {/* Applications Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {filteredRoutes.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Layers size={42} color="var(--text-muted)" />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>No Applications Exposed Yet</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '440px' }}>
              Expose your first service through the Proton VPN tunnel. All traffic arrives via your forwarded Proton port and is routed dynamically to your local applications.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingRoute(null);
                setIsAddModalOpen(true);
              }}
              style={{ marginTop: '0.5rem' }}
            >
              <Plus size={16} /> Expose First Application
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Application</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Ingress Route</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Upstream Target</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Latency</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Features</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((route) => {
                  return (
                    <tr
                      key={route.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>
                        <div
                          style={{ cursor: 'pointer', color: 'var(--text-primary)' }}
                          onClick={() => setSelectedRoute(route)}
                        >
                          {route.name}
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)' }}>
                          {route.routing_type === 'domain' ? (
                            <Globe size={14} color="var(--accent-indigo)" />
                          ) : (
                            <HardDrive size={14} color="var(--accent-cyan, #06b6d4)" />
                          )}
                          <span>{route.routing_type === 'domain' ? route.domain : route.path}</span>
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {route.target_host}:{route.target_port}
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        {getStatusBadge(route.status)}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                        {route.response_time_ms > 0 ? `${route.response_time_ms} ms` : '—'}
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-demo" style={{ fontSize: '0.7rem' }}>
                            {route.protocol.toUpperCase()}
                          </span>
                          {route.websocket && <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>WS</span>}
                          {route.tls && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>TLS setup required</span>}
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            title={route.enabled ? 'Disable route' : 'Enable route'}
                            onClick={() => handleToggleEnable(route)}
                            style={{
                              padding: '0.4rem',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              color: route.enabled ? 'var(--color-warning)' : 'var(--color-success)',
                              cursor: 'pointer',
                            }}
                          >
                            <Power size={14} />
                          </button>

                          <button
                            type="button"
                            title="Edit route"
                            onClick={() => {
                              setEditingRoute(route);
                              setIsAddModalOpen(true);
                            }}
                            style={{
                              padding: '0.4rem',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            title="View details & metrics"
                            onClick={() => setSelectedRoute(route)}
                            style={{
                              padding: '0.4rem',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              color: 'var(--accent-indigo)',
                              cursor: 'pointer',
                            }}
                          >
                            <ExternalLink size={14} />
                          </button>

                          <button
                            type="button"
                            title="Delete route"
                            onClick={() => handleDeleteRoute(route)}
                            style={{
                              padding: '0.4rem',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              color: 'var(--color-danger)',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AddApplicationModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingRoute(null);
        }}
        onSaved={fetchProxyData}
        editingRoute={editingRoute}
      />

      {/* Application Details Modal */}
      <ApplicationDetailsModal
        isOpen={selectedRoute !== null}
        onClose={() => setSelectedRoute(null)}
        route={selectedRoute}
        metrics={selectedRoute ? metricsMap[selectedRoute.id] || null : null}
        publicEndpoint={publicEndpoint}
        onEdit={(route) => {
          setEditingRoute(route);
          setIsAddModalOpen(true);
        }}
        onToggleEnable={handleToggleEnable}
        onDelete={handleDeleteRoute}
      />
    </div>
  );
};
