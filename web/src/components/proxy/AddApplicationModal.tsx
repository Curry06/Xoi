import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { ProxyRoute, CreateRouteRequest, RoutingType, TargetProbeResult } from '../../types';
import { apiClient } from '../../api/client';
import { useToast } from '../Toast';
import { Globe, HardDrive, CheckCircle, XCircle, Loader2, Play } from 'lucide-react';

interface AddApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingRoute?: ProxyRoute | null;
}

export const AddApplicationModal: React.FC<AddApplicationModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingRoute,
}) => {
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [routingType, setRoutingType] = useState<RoutingType>('domain');
  const [domain, setDomain] = useState('');
  const [path, setPath] = useState('');
  const [protocol, setProtocol] = useState('http');
  const [targetHost, setTargetHost] = useState('127.0.0.1');
  const [targetPort, setTargetPort] = useState('3001');
  const [websocket, setWebsocket] = useState(true);
  const [tls, setTls] = useState(false);
  const [healthCheck, setHealthCheck] = useState(true);
  const [enabled, setEnabled] = useState(true);

  const [isTesting, setIsTesting] = useState(false);
  const [probeResult, setProbeResult] = useState<TargetProbeResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingRoute) {
      setName(editingRoute.name);
      setRoutingType(editingRoute.routing_type);
      setDomain(editingRoute.domain || '');
      setPath(editingRoute.path || '');
      setProtocol(editingRoute.protocol || 'http');
      setTargetHost(editingRoute.target_host);
      setTargetPort(String(editingRoute.target_port));
      setWebsocket(editingRoute.websocket);
      setTls(false);
      setHealthCheck(editingRoute.health_check);
      setEnabled(editingRoute.enabled);
    } else {
      setName('');
      setRoutingType('domain');
      setDomain('');
      setPath('');
      setProtocol('http');
      setTargetHost('127.0.0.1');
      setTargetPort('3001');
      setWebsocket(true);
      setTls(false);
      setHealthCheck(true);
      setEnabled(true);
    }
    setProbeResult(null);
  }, [editingRoute, isOpen]);

  const handleTestTarget = async () => {
    const portNum = parseInt(targetPort, 10);
    if (!targetHost || isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      showToast('Please specify a valid target host and port (1-65535)', 'error');
      return;
    }
    if (tls) {
      showToast('Public TLS requires DNS-01 or a supplied certificate and is not configured', 'error');
      return;
    }

    try {
      setIsTesting(true);
      setProbeResult(null);
      const res = await apiClient.testProxyTarget(targetHost, portNum);
      setProbeResult(res);
      if (res.reachable) {
        showToast(`Target reachable! Latency: ${res.latency_ms}ms`, 'success');
      } else {
        showToast(res.error || 'Target is unreachable', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed probing target', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const portNum = parseInt(targetPort, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      showToast('Invalid target port (must be 1-65535)', 'error');
      return;
    }

    const payload: CreateRouteRequest = {
      name: name.trim(),
      routing_type: routingType,
      domain: routingType === 'domain' ? domain.trim() : undefined,
      path: routingType === 'path' ? path.trim() : undefined,
      protocol,
      target_host: targetHost.trim(),
      target_port: portNum,
      websocket,
      tls,
      health_check: healthCheck,
      enabled,
    };

    try {
      setIsSubmitting(true);
      if (editingRoute) {
        await apiClient.updateProxyRoute(editingRoute.id, payload);
        showToast(`Application '${payload.name}' updated successfully`, 'success');
      } else {
        await apiClient.createProxyRoute(payload);
        showToast(`Application '${payload.name}' exposed successfully`, 'success');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed saving application route', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingRoute ? 'Edit Application Route' : 'Expose New Public Application'}
      maxWidth="580px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Application Name */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
            Application Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ResQID Frontend, Grafana, Next.js App"
            style={{
              width: '100%',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        {/* Routing Mode Selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
            Routing Mode *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setRoutingType('domain')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid',
                cursor: 'pointer',
                backgroundColor: routingType === 'domain' ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: routingType === 'domain' ? 'var(--accent-indigo)' : 'var(--border-subtle)',
                color: routingType === 'domain' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
              }}
            >
              <Globe size={16} />
              Domain Name (Recommended)
            </button>

            <button
              type="button"
              onClick={() => setRoutingType('path')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid',
                cursor: 'pointer',
                backgroundColor: routingType === 'path' ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: routingType === 'path' ? 'var(--accent-indigo)' : 'var(--border-subtle)',
                color: routingType === 'path' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
              }}
            >
              <HardDrive size={16} />
              URL Path Prefix
            </button>
          </div>
        </div>

        {/* Domain or Path Input */}
        {routingType === 'domain' ? (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
              Domain Name (FQDN) *
            </label>
            <input
              type="text"
              required={routingType === 'domain'}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. app1.example.com, resqid.mydomain.org"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
              Point this domain (or wildcard CNAME) to your Proton VPN Public IP.
            </span>
          </div>
        ) : (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
              Path Prefix *
            </label>
            <input
              type="text"
              required={routingType === 'path'}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="e.g. /app1, /api/v1"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '0.25rem', display: 'block' }}>
              ⚠️ Note: Ensure your web application supports subpath base URLs.
            </span>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
            Upstream Protocol *
          </label>
          <select
            value={protocol}
            onChange={(event) => setProtocol(event.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="websocket">WebSocket</option>
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
            HTTPS encrypts the Caddy-to-application connection; Caddy handles WebSocket upgrades automatically.
          </span>
        </div>

        {/* Upstream Internal Target & Port */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
              Target Host *
            </label>
            <input
              type="text"
              required
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              placeholder="127.0.0.1"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
              Target Port *
            </label>
            <input
              type="number"
              required
              min="1"
              max="65535"
              value={targetPort}
              onChange={(e) => setTargetPort(e.target.value)}
              placeholder="3001"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.75rem' }}>
          Applications sharing the Gluetun namespace should use a unique loopback port. Additional target hosts require an explicit dashboard allowlist.
        </span>

        {/* Target Probe / Test Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Connectivity Test</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Verify target is listening on {targetHost}:{targetPort}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {probeResult && (
              <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: probeResult.reachable ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {probeResult.reachable ? <CheckCircle size={15} /> : <XCircle size={15} />}
                {probeResult.reachable ? `${probeResult.latency_ms}ms` : 'Offline'}
              </span>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestTarget}
              disabled={isTesting}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            >
              {isTesting ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
              Test Target
            </button>
          </div>
        </div>

        {/* Feature Toggles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={websocket}
              onChange={(e) => setWebsocket(e.target.checked)}
              style={{ accentColor: 'var(--accent-indigo)' }}
            />
            WebSocket Support
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tls}
              disabled
              style={{ accentColor: 'var(--accent-indigo)' }}
            />
            Public TLS (certificate required)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={healthCheck}
              onChange={(e) => setHealthCheck(e.target.checked)}
              style={{ accentColor: 'var(--accent-indigo)' }}
            />
            Health Probes
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ accentColor: 'var(--accent-indigo)' }}
            />
            Route Enabled
          </label>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : editingRoute ? 'Update Route' : 'Create Route'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
