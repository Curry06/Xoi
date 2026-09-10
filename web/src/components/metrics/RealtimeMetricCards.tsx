import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Activity,
  Zap,
  Radio,
  Clock,
  Lock,
  Layers,
} from 'lucide-react';
import { TunnelMetrics, VPNSettings, TunnelState } from '../../types/vpn';

interface RealtimeMetricCardsProps {
  metrics: TunnelMetrics;
  settings: VPNSettings;
  state: TunnelState;
  trafficHistory: { download: number; upload: number }[];
}

export const RealtimeMetricCards: React.FC<RealtimeMetricCardsProps> = ({
  metrics,
  settings,
  state,
  trafficHistory,
}) => {
  const isConnected = state === 'connected';

  // Format uptime
  const formatUptime = (totalSeconds: number) => {
    if (!isConnected) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Helper to render mini sparkline SVG
  const renderSparkline = (dataPoints: number[], strokeColor: string) => {
    if (!dataPoints || dataPoints.length < 2) return null;
    const width = 110;
    const height = 30;
    const max = Math.max(...dataPoints, 1);
    const min = Math.min(...dataPoints, 0);
    const range = max - min || 1;

    const points = dataPoints
      .slice(-14)
      .map((val, idx, arr) => {
        const x = (idx / (arr.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <path
          d={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const downHistory = trafficHistory.map((h) => h.download);
  const upHistory = trafficHistory.map((h) => h.upload);
  const jitterHistory = [28, 29, 31, 30, 32, metrics.latencyMs, metrics.latencyMs - 1, metrics.latencyMs + 2, metrics.latencyMs];
  const packetHistory = [1200, 1400, 1600, 1800, 2100, metrics.packetsPerSec, metrics.packetsPerSec + 120, metrics.packetsPerSec];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
      }}
    >
      {/* 1. Download Rate */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            INGRESS THROUGHPUT
          </span>
          <ArrowDown size={17} color="var(--accent-cyan)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            {isConnected ? metrics.downloadMbps.toFixed(1) : '0.0'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mbps</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Peak: <strong>{metrics.peakMbps.toFixed(1)} Mbps</strong>
          </span>
          {renderSparkline(downHistory, '#06b6d4')}
        </div>
      </div>

      {/* 2. Upload Rate */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            EGRESS THROUGHPUT
          </span>
          <ArrowUp size={17} color="var(--accent-violet)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-violet)' }}>
            {isConnected ? metrics.uploadMbps.toFixed(1) : '0.0'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mbps</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Avg: <strong>{metrics.averageMbps.toFixed(1)} Mbps</strong>
          </span>
          {renderSparkline(upHistory, '#8b5cf6')}
        </div>
      </div>

      {/* 3. Latency / RTT */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            ROUND-TRIP LATENCY (RTT)
          </span>
          <Activity size={17} color={metrics.latencyMs > 100 ? 'var(--color-warning)' : 'var(--color-success)'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: metrics.latencyMs > 100 ? 'var(--color-warning)' : 'var(--text-primary)',
            }}
          >
            {isConnected ? metrics.latencyMs : '--'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ms</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Jitter: ±{(metrics.latencyMs * 0.08).toFixed(1)} ms
          </span>
          {renderSparkline(jitterHistory, metrics.latencyMs > 100 ? '#f59e0b' : '#10b981')}
        </div>
      </div>

      {/* 4. Active Connections */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            ACTIVE CONNS (NAT)
          </span>
          <Layers size={17} color="var(--accent-indigo)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {isConnected ? metrics.activeConnections : 0}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>flows</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            TCP: <strong>{Math.floor(metrics.activeConnections * 0.72)}</strong> | UDP:{' '}
            <strong>{Math.ceil(metrics.activeConnections * 0.28)}</strong>
          </span>
          {renderSparkline([metrics.activeConnections - 4, metrics.activeConnections - 2, metrics.activeConnections], '#6366f1')}
        </div>
      </div>

      {/* 5. Packet Rate */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            PACKET VELOCITY
          </span>
          <Zap size={17} color="var(--accent-cyan)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {isConnected ? metrics.packetsPerSec.toLocaleString() : '0'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>pps</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            MTU: <strong>1420 B</strong>
          </span>
          {renderSparkline(packetHistory, '#06b6d4')}
        </div>
      </div>

      {/* 6. Packet Loss */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            PACKET LOSS
          </span>
          <Radio size={17} color={metrics.packetLossPercent > 0.5 ? 'var(--color-danger)' : 'var(--color-success)'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: metrics.packetLossPercent > 1.0 ? 'var(--color-danger)' : 'var(--text-primary)',
            }}
          >
            {isConnected ? metrics.packetLossPercent.toFixed(2) : '0.00'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.725rem',
              padding: '0.1rem 0.5rem',
              borderRadius: '9999px',
              backgroundColor: metrics.packetLossPercent > 1 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: metrics.packetLossPercent > 1 ? 'var(--color-danger)' : 'var(--color-success)',
              fontWeight: 700,
            }}
          >
            {metrics.packetLossPercent === 0 ? 'PRISTINE 0% LOSS' : metrics.packetLossPercent > 1 ? 'DEGRADED' : 'NOMINAL'}
          </span>
        </div>
      </div>

      {/* 7. Tunnel Uptime */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            SESSION UPTIME
          </span>
          <Clock size={17} color="var(--accent-indigo)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {formatUptime(metrics.uptimeSeconds)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Interface: <strong style={{ color: 'var(--text-primary)' }}>{settings.interfaceName}</strong>
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-muted)',
            }}
          >
            0 Drops
          </span>
        </div>
      </div>

      {/* 8. Encryption & Handshake */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            CIPHER & KEY ROTATION
          </span>
          <Lock size={17} color="var(--color-success)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {settings.encryption}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Last Handshake:{' '}
            <strong style={{ color: 'var(--color-success)' }}>
              {isConnected ? `${settings.handshakeAgoSeconds}s ago` : 'None'}
            </strong>
          </span>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--color-success)' : 'var(--text-muted)',
              boxShadow: isConnected ? '0 0 8px var(--color-success)' : 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};
