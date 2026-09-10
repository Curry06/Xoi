import React, { useState, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { TrafficDataPoint } from '../../types/vpn';

interface LiveTrafficGraphProps {
  data: TrafficDataPoint[];
  peakMbps: number;
  averageMbps: number;
  currentDown: number;
  currentUp: number;
}

type TimeRange = '1M' | '5M' | '15M' | '1H' | '6H' | '24H';

export const LiveTrafficGraph: React.FC<LiveTrafficGraphProps> = ({
  data,
  peakMbps,
  averageMbps,
  currentDown,
  currentUp,
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('5M');
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    point: TrafficDataPoint;
  } | null>(null);

  // Filter or slice data based on range
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    let sliceCount = 30;
    switch (selectedRange) {
      case '1M':
        sliceCount = 15;
        break;
      case '5M':
        sliceCount = 30;
        break;
      case '15M':
        sliceCount = 45;
        break;
      case '1H':
        sliceCount = 60;
        break;
      case '6H':
      case '24H':
        sliceCount = data.length;
        break;
    }
    return data.slice(-sliceCount);
  }, [data, selectedRange]);

  // Chart dimensions
  const width = 800;
  const height = 240;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate max scale value with minimum headroom
  const maxVal = useMemo(() => {
    if (filteredData.length === 0) return 50;
    const maxInFiltered = Math.max(
      ...filteredData.map((d) => Math.max(d.download, d.upload))
    );
    return Math.max(20, Math.ceil((maxInFiltered * 1.25) / 10) * 10);
  }, [filteredData]);

  // Points conversion
  const points = useMemo(() => {
    if (filteredData.length <= 1) return { downPath: '', upPath: '', downArea: '', upArea: '', coords: [] };

    const coords = filteredData.map((d, index) => {
      const x = paddingLeft + (index / (filteredData.length - 1)) * chartWidth;
      const yDown = paddingTop + chartHeight - (d.download / maxVal) * chartHeight;
      const yUp = paddingTop + chartHeight - (d.upload / maxVal) * chartHeight;
      return { x, yDown, yUp, point: d };
    });

    const downLineStr = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yDown.toFixed(1)}`).join(' ');
    const upLineStr = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yUp.toFixed(1)}`).join(' ');

    const groundY = paddingTop + chartHeight;
    const downAreaStr = `${downLineStr} L ${coords[coords.length - 1].x.toFixed(1)} ${groundY} L ${coords[0].x.toFixed(1)} ${groundY} Z`;
    const upAreaStr = `${upLineStr} L ${coords[coords.length - 1].x.toFixed(1)} ${groundY} L ${coords[0].x.toFixed(1)} ${groundY} Z`;

    return { downPath: downLineStr, upPath: upLineStr, downArea: downAreaStr, upArea: upAreaStr, coords };
  }, [filteredData, maxVal, chartWidth, chartHeight, paddingLeft, paddingTop]);

  // Y-axis grid ticks (4 intervals)
  const yTicks = useMemo(() => {
    const ticks = [];
    const step = maxVal / 4;
    for (let i = 0; i <= 4; i++) {
      const val = step * i;
      const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
      ticks.push({ val: val.toFixed(0), y });
    }
    return ticks;
  }, [maxVal, chartHeight, paddingTop]);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
      {/* Header with Title, Stats & Range Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Real-Time Bandwidth & Throughput
              </h3>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.45rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--color-success)',
                  borderRadius: '9999px',
                  fontWeight: 700,
                }}
              >
                LIVE 1s
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Dual-series ingress / egress telemetry across the active tunnel interface
            </p>
          </div>
        </div>

        {/* Live Gauges & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          {/* Legend & Current Speeds */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.825rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: '#06b6d4',
                  boxShadow: '0 0 8px rgba(6, 182, 212, 0.6)',
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Down:</span>
              <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {currentDown.toFixed(1)} Mbps
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: '#8b5cf6',
                  boxShadow: '0 0 8px rgba(139, 92, 246, 0.6)',
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Up:</span>
              <strong style={{ color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)' }}>
                {currentUp.toFixed(1)} Mbps
              </strong>
            </div>

            <div style={{ height: '16px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />

            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Peak: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{peakMbps.toFixed(1)}</span> | Avg:{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{averageMbps.toFixed(1)}</span> Mbps
            </div>
          </div>

          {/* Range Selector Buttons */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '2px',
            }}
          >
            {(['1M', '5M', '15M', '1H', '6H', '24H'] as TimeRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedRange(range)}
                style={{
                  background: selectedRange === range ? 'var(--accent-indigo)' : 'transparent',
                  color: selectedRange === range ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Time-Series Chart */}
      <div style={{ width: '100%', height: '240px', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {/* Download Gradient */}
            <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>

            {/* Upload Gradient */}
            <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines & Y-axis labels */}
          {yTicks.map((tick) => (
            <g key={tick.val}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeDasharray="4,4"
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {tick.val}M
              </text>
            </g>
          ))}

          {/* Area Fills */}
          {points.downArea && <path d={points.downArea} fill="url(#downGrad)" />}
          {points.upArea && <path d={points.upArea} fill="url(#upGrad)" />}

          {/* Stroke Lines */}
          {points.downPath && (
            <path
              d={points.downPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {points.upPath && (
            <path
              d={points.upPath}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover interactive columns */}
          {points.coords.map((coord, idx) => (
            <g
              key={idx}
              onMouseEnter={() =>
                setHoveredPoint({
                  x: coord.x,
                  y: Math.min(coord.yDown, coord.yUp),
                  point: coord.point,
                })
              }
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={coord.x - (chartWidth / points.coords.length) / 2}
                y={paddingTop}
                width={chartWidth / points.coords.length}
                height={chartHeight}
                fill="transparent"
              />
            </g>
          ))}

          {/* Hover indicator line & dots */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
                y2={paddingTop + chartHeight}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              {/* Down dot */}
              <circle
                cx={hoveredPoint.x}
                cy={
                  paddingTop +
                  chartHeight -
                  (hoveredPoint.point.download / maxVal) * chartHeight
                }
                r="4.5"
                fill="#06b6d4"
                stroke="#090d16"
                strokeWidth="2"
              />
              {/* Up dot */}
              <circle
                cx={hoveredPoint.x}
                cy={
                  paddingTop +
                  chartHeight -
                  (hoveredPoint.point.upload / maxVal) * chartHeight
                }
                r="4.5"
                fill="#8b5cf6"
                stroke="#090d16"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X Axis Time Labels */}
          {points.coords.length > 0 && (
            <>
              <text
                x={paddingLeft}
                y={height - 8}
                textAnchor="start"
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {points.coords[0].point.timestamp}
              </text>
              <text
                x={width - paddingRight}
                y={height - 8}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {points.coords[points.coords.length - 1].point.timestamp}
              </text>
            </>
          )}
        </svg>

        {/* Hover Floating Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: '10px',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(11, 17, 30, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.4rem 0.65rem',
              pointerEvents: 'none',
              fontSize: '0.75rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)' }}>
              {hoveredPoint.point.timestamp}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)' }}>
              <span>↓ Down:</span>
              <strong>{hoveredPoint.point.download.toFixed(2)} Mbps</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-violet)' }}>
              <span>↑ Up:</span>
              <strong>{hoveredPoint.point.upload.toFixed(2)} Mbps</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
