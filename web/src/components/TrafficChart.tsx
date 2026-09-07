import React, { useState, useEffect } from 'react';
import { TrafficMetrics, TrafficPoint } from '../types';
import { formatRate } from '../hooks/useLiveState';
import { ArrowDown, ArrowUp, Activity } from 'lucide-react';

interface TrafficChartProps {
  traffic: TrafficMetrics;
}

export const TrafficChart: React.FC<TrafficChartProps> = ({ traffic }) => {
  const [timeRange, setTimeRange] = useState<'1m' | '15m' | '1h'>('1m');
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const handleVisibility = () => {
      setIsPaused(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const getPoints = (): TrafficPoint[] => {
    switch (timeRange) {
      case '15m':
        return traffic.history_15m || [];
      case '1h':
        return traffic.history_1h || [];
      default:
        return traffic.history_1m || [];
    }
  };

  const points = getPoints();

  // If traffic telemetry is not available
  if (!traffic.available) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '260px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <Activity size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
          Traffic Telemetry Unavailable
        </h4>
        <p style={{ fontSize: '0.85rem', maxWidth: '340px' }}>
          Real-time interface counters could not be read. Gluetun does not expose an internal traffic API.
        </p>
      </div>
    );
  }

  // Calculate scales for SVG rendering
  const width = 600;
  const height = 180;
  const padding = 25;

  const maxVal = Math.max(
    ...points.map((p) => Math.max(p.download_rate, p.upload_rate)),
    1024 * 100 // At least 100 KB/s scale
  );

  const getX = (index: number) => {
    if (points.length <= 1) return padding;
    return padding + (index / (points.length - 1)) * (width - 2 * padding);
  };

  const getY = (val: number) => {
    const ratio = Math.min(val / maxVal, 1);
    return height - padding - ratio * (height - 2 * padding);
  };

  // Build SVG path
  const buildAreaPath = (getter: (p: TrafficPoint) => number) => {
    if (points.length === 0) return '';
    const coords = points.map((p, i) => `${getX(i)},${getY(getter(p))}`);
    const firstX = getX(0);
    const lastX = getX(points.length - 1);
    const bottomY = height - padding;
    return `M ${firstX},${bottomY} L ${coords.join(' L ')} L ${lastX},${bottomY} Z`;
  };

  const buildLinePath = (getter: (p: TrafficPoint) => number) => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(getter(p))}`).join(' ');
  };

  const downloadArea = buildAreaPath((p) => p.download_rate);
  const downloadLine = buildLinePath((p) => p.download_rate);
  const uploadArea = buildAreaPath((p) => p.upload_rate);
  const uploadLine = buildLinePath((p) => p.upload_rate);

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Network Traffic</h3>
            {isPaused && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--color-warning)',
                }}
              >
                Paused (Tab hidden)
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time tunnel throughput ({traffic.interface || 'tun0'})
          </p>
        </div>

        {/* Current Rates & Time Range Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-cyan)' }}>
              <ArrowDown size={15} />
              <span style={{ fontWeight: 600 }}>{formatRate(traffic.download_rate)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-violet)' }}>
              <ArrowUp size={15} />
              <span style={{ fontWeight: 600 }}>{formatRate(traffic.upload_rate)}</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
            }}
          >
            {(['1m', '15m', '1h'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: timeRange === r ? 'var(--accent-indigo)' : 'transparent',
                  color: timeRange === r ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ width: '100%', height: `${height}px`, position: 'relative' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding}
            y1={padding}
            x2={width - padding}
            y2={padding}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeDasharray="4 4"
          />
          <line
            x1={padding}
            y1={height / 2}
            x2={width - padding}
            y2={height / 2}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeDasharray="4 4"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="rgba(255, 255, 255, 0.1)"
          />

          {/* Download Area & Line */}
          {downloadArea && <path d={downloadArea} fill="url(#downGrad)" />}
          {downloadLine && <path d={downloadLine} fill="none" stroke="#06b6d4" strokeWidth="2" />}

          {/* Upload Area & Line */}
          {uploadArea && <path d={uploadArea} fill="url(#upGrad)" />}
          {uploadLine && <path d={uploadLine} fill="none" stroke="#8b5cf6" strokeWidth="1.75" />}
        </svg>

        {/* Axis Labels */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
            padding: '0 0.5rem',
          }}
        >
          <span>{timeRange === '1m' ? '1m ago' : timeRange === '15m' ? '15m ago' : '1h ago'}</span>
          <span>Max: {formatRate(maxVal)}</span>
          <span>Now</span>
        </div>
      </div>
    </div>
  );
};
