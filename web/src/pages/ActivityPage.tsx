import React, { useState } from 'react';
import {
  Activity,
  Download,
  Shield,
  Radio,
  Globe,
  User,
  Info,
  Search,
  RefreshCw,
} from 'lucide-react';
import { HistoryEvent, EventType } from '../types';
import { useToast } from '../components/Toast';

interface ActivityPageProps {
  events: HistoryEvent[];
  onRefresh: () => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ events, onRefresh }) => {
  const { showToast } = useToast();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleExportDiagnostics = async () => {
    try {
      const res = await fetch('/api/dashboard/history/export');
      if (!res.ok) throw new Error('Failed exporting');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gluetun-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported sanitized diagnostics log', 'success');
    } catch {
      showToast('Failed exporting diagnostics', 'error');
    }
  };

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'connection_state':
        return <Shield size={16} color="var(--color-success)" />;
      case 'ip_change':
        return <Globe size={16} color="var(--accent-cyan)" />;
      case 'port_change':
        return <Radio size={16} color="var(--accent-indigo)" />;
      case 'audit':
        return <User size={16} color="var(--accent-violet)" />;
      case 'health_check':
        return <Activity size={16} color="var(--color-info)" />;
      default:
        return <Info size={16} color="var(--text-muted)" />;
    }
  };

  const filteredEvents = events.filter((e) => {
    if (selectedType !== 'all' && e.type !== selectedType) return false;
    if (selectedSeverity !== 'all' && e.severity !== selectedSeverity) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchMessage = e.message.toLowerCase().includes(q);
      return matchTitle || matchMessage;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Activity & Diagnostic Audit Log</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Audited timeline of connection lifecycle changes, IP and port allocations, and user events.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onRefresh}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportDiagnostics}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <Download size={16} />
            Export Diagnostics
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div
          style={{
            flex: 1,
            minWidth: '220px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.45rem 0.75rem',
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              width: '100%',
              outline: 'none',
              fontSize: '0.85rem',
            }}
          />
        </div>

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.45rem 0.75rem',
            fontSize: '0.85rem',
          }}
        >
          <option value="all">All Event Types</option>
          <option value="connection_state">Connection State</option>
          <option value="ip_change">IP Changes</option>
          <option value="port_change">Port Changes</option>
          <option value="audit">User Audit</option>
          <option value="health_check">Health Probes</option>
          <option value="diagnostic">Diagnostics</option>
        </select>

        {/* Severity Filter */}
        <select
          value={selectedSeverity}
          onChange={(e) => setSelectedSeverity(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.45rem 0.75rem',
            fontSize: '0.85rem',
          }}
        >
          <option value="all">All Severities</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Timeline List */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No activity events matching your current filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredEvents.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                  }}
                >
                  {getEventIcon(evt.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{evt.title}</strong>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor:
                            evt.severity === 'error'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : evt.severity === 'warn'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)',
                          color:
                            evt.severity === 'error'
                              ? 'var(--color-danger)'
                              : evt.severity === 'warn'
                              ? 'var(--color-warning)'
                              : 'var(--color-success)',
                        }}
                      >
                        {evt.severity}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                    {evt.message}
                  </p>

                  {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                    <div
                      style={{
                        marginTop: '0.4rem',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '4px',
                      }}
                    >
                      {JSON.stringify(evt.metadata)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
