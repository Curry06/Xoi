import React from 'react';
import { SystemHealthMetrics } from '../../types/vpn';
import { Cpu, HardDrive, Clock, Layers } from 'lucide-react';

interface SystemViewProps {
  metrics: SystemHealthMetrics;
}

export const SystemView: React.FC<SystemViewProps> = ({ metrics }) => {
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const memPercent = Math.round((metrics.memoryUsageGB / metrics.memoryTotalGB) * 100);
  const diskPercent = Math.round((metrics.diskUsageGB / metrics.diskTotalGB) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Host Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* CPU Meter */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>HOST CPU LOAD</span>
            <Cpu size={18} color="var(--accent-cyan)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {metrics.cpuUsagePercent.toFixed(1)}%
          </div>
          <div
            style={{
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginTop: '0.6rem',
            }}
          >
            <div
              style={{
                width: `${metrics.cpuUsagePercent}%`,
                height: '100%',
                backgroundColor: metrics.cpuUsagePercent > 80 ? 'var(--color-danger)' : 'var(--accent-cyan)',
                borderRadius: '3px',
              }}
            />
          </div>
        </div>

        {/* Memory Meter */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>MEMORY USAGE</span>
            <Layers size={18} color="var(--accent-indigo)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {metrics.memoryUsageGB.toFixed(1)}{' '}
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {metrics.memoryTotalGB} GB</span>
          </div>
          <div
            style={{
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginTop: '0.6rem',
            }}
          >
            <div
              style={{
                width: `${memPercent}%`,
                height: '100%',
                backgroundColor: 'var(--accent-indigo)',
                borderRadius: '3px',
              }}
            />
          </div>
        </div>

        {/* Disk Meter */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>PERSISTENT STORAGE</span>
            <HardDrive size={18} color="var(--accent-violet)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {metrics.diskUsageGB.toFixed(1)}{' '}
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {metrics.diskTotalGB} GB</span>
          </div>
          <div
            style={{
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginTop: '0.6rem',
            }}
          >
            <div
              style={{
                width: `${diskPercent}%`,
                height: '100%',
                backgroundColor: 'var(--accent-violet)',
                borderRadius: '3px',
              }}
            />
          </div>
        </div>

        {/* Goroutines & Host Uptime */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>GO RUNTIME</span>
            <Clock size={18} color="var(--color-success)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-success)' }}>
            {metrics.goroutinesCount} Goroutines
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Host Uptime: {formatUptime(metrics.hostUptimeSeconds)}
          </div>
        </div>
      </div>

      {/* Gluetun Core Daemons Checklist */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Gluetun Core Subsystems</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Engine worker threads and supervisor lifecycle status
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {metrics.services.map((srv) => (
            <div
              key={srv.name}
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {srv.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {srv.details}
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  backgroundColor:
                    srv.status === 'running'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : srv.status === 'degraded'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  color:
                    srv.status === 'running'
                      ? 'var(--color-success)'
                      : srv.status === 'degraded'
                      ? 'var(--color-warning)'
                      : 'var(--color-danger)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {srv.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
