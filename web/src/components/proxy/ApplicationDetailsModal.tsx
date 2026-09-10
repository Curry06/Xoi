import React from 'react';
import { Modal } from '../Modal';
import { ProxyRoute, RouteMetrics, PublicEndpoint } from '../../types';
import {
  Globe,
  HardDrive,
  Activity,
  Zap,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  Edit2,
  Trash2,
  Power,
} from 'lucide-react';

interface ApplicationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: ProxyRoute | null;
  metrics: RouteMetrics | null;
  publicEndpoint: PublicEndpoint | null;
  onEdit: (route: ProxyRoute) => void;
  onToggleEnable: (route: ProxyRoute) => void;
  onDelete: (route: ProxyRoute) => void;
}

export const ApplicationDetailsModal: React.FC<ApplicationDetailsModalProps> = ({
  isOpen,
  onClose,
  route,
  metrics,
  publicEndpoint,
  onEdit,
  onToggleEnable,
  onDelete,
}) => {
  if (!route) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'var(--color-success)';
      case 'DISABLED':
        return 'var(--text-muted)';
      case 'TARGET_UNREACHABLE':
      case 'UNHEALTHY':
        return 'var(--color-danger)';
      default:
        return 'var(--color-warning)';
    }
  };

  const publicScheme = route.protocol === 'websocket' ? 'ws' : 'http';
  const publicHost = route.routing_type === 'domain' ? route.domain : publicEndpoint?.public_ip;
  const publicPath = route.routing_type === 'path' ? route.path : '';
  const publicUrl =
    publicHost && publicEndpoint?.forwarded_port
      ? `${publicScheme}://${publicHost}:${publicEndpoint.forwarded_port}${publicPath}`
      : 'Endpoint Pending';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={route.name} maxWidth="640px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Status Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(route.status),
                }}
              />
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: getStatusColor(route.status) }}>
                {route.status}
              </span>
              <span className="badge badge-demo" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                {route.protocol}
              </span>
              {route.websocket && <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>WS</span>}
              {route.tls && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>TLS setup required</span>}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Created on {new Date(route.created_at).toLocaleString()}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Latency</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {route.response_time_ms > 0 ? `${route.response_time_ms} ms` : '—'}
            </div>
          </div>
        </div>

        {/* Public Endpoint & Internal Target Card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Globe size={14} color="var(--accent-indigo)" />
              External Public Ingress
            </div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
              {publicUrl}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Via Proton VPN Forwarded Port: {publicEndpoint?.forwarded_port || '—'}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <HardDrive size={14} color="var(--accent-cyan, #06b6d4)" />
              Internal Upstream Target
            </div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {route.target_host}:{route.target_port}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              In Gluetun Network Namespace
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={16} color="var(--accent-indigo)" />
            Application Telemetry & Performance
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Zap size={13} /> Requests
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>
                {metrics?.total_requests || 0}
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ArrowDownRight size={13} color="var(--color-success)" /> RX Bandwidth
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                {formatBytes(metrics?.bytes_received || 0)}
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ArrowUpRight size={13} color="var(--accent-indigo)" /> TX Bandwidth
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                {formatBytes(metrics?.bytes_sent || 0)}
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertCircle size={13} color="var(--color-danger)" /> Errors
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem', color: (metrics?.error_count || 0) > 0 ? 'var(--color-danger)' : 'inherit' }}>
                {metrics?.error_count || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete application '${route.name}'?`)) {
                onDelete(route);
                onClose();
              }
            }}
            style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Trash2 size={16} />
            Delete Route
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onToggleEnable(route)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Power size={16} color={route.enabled ? 'var(--color-warning)' : 'var(--color-success)'} />
              {route.enabled ? 'Disable Route' : 'Enable Route'}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onEdit(route);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Edit2 size={16} />
              Edit Settings
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
