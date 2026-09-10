import React, { useEffect, useRef } from 'react';
import {
  Laptop,
  Router,
  Lock,
  Server,
  Globe,
  ArrowDown,
  ArrowUp,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Clock,
  Radio,
} from 'lucide-react';
import { TunnelState, TunnelMetrics, VPNSettings } from '../../types/vpn';

interface TunnelHeroFlowProps {
  state: TunnelState;
  metrics: TunnelMetrics;
  settings: VPNSettings;
  statusMessage?: string;
  reconnectStep?: string;
  reconnectProgress?: number;
}

export const TunnelHeroFlow: React.FC<TunnelHeroFlowProps> = ({
  state,
  metrics,
  settings,
  statusMessage,
  reconnectStep,
  reconnectProgress = 100,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Format uptime
  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isConnected = state === 'connected';
  const isDegraded = state === 'degraded';
  const isConnecting = state === 'connecting' || state === 'reconnecting';
  const isDisconnected = state === 'disconnected' || state === 'blocked';

  // 60 FPS Particle Canvas Simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 900);
    let height = (canvas.height = 140);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = 140;
    };
    window.addEventListener('resize', handleResize);

    // Particle pool
    interface Packet {
      x: number;
      y: number;
      speed: number;
      size: number;
      color: string;
      glow: string;
      isEncrypted: boolean;
      direction: 'down' | 'up';
    }

    const packets: Packet[] = [];
    const packetCount = isConnected || isDegraded ? Math.min(36, Math.max(12, Math.round(metrics.downloadMbps / 3))) : 0;

    for (let i = 0; i < packetCount; i++) {
      packets.push({
        x: Math.random() * width,
        y: height / 2 + (Math.random() - 0.5) * 16,
        // Bandwidth-proportional speed
        speed: Math.max(1.8, Math.min(10, (metrics.downloadMbps / 20) * 2.8 + (Math.random() * 0.8))),
        size: Math.random() * 2.5 + 2.5,
        color: '#38bdf8',
        glow: 'rgba(56, 189, 248, 0.6)',
        isEncrypted: false,
        direction: Math.random() > 0.2 ? 'down' : 'up',
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (isConnected || isDegraded) {
        // Draw connection bus line
        ctx.beginPath();
        ctx.strokeStyle = isDegraded ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(40, height / 2);
        ctx.lineTo(width - 40, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tunnel encrypted highlight zone (approx middle 40%)
        const tunnelStart = width * 0.32;
        const tunnelEnd = width * 0.68;

        const tunnelGradient = ctx.createLinearGradient(tunnelStart, 0, tunnelEnd, 0);
        tunnelGradient.addColorStop(0, 'rgba(59, 130, 246, 0.02)');
        tunnelGradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.12)');
        tunnelGradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

        ctx.fillStyle = tunnelGradient;
        ctx.fillRect(tunnelStart, height / 2 - 24, tunnelEnd - tunnelStart, 48);

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tunnelStart, height / 2 - 24, tunnelEnd - tunnelStart, 48);

        // Update and draw packets
        packets.forEach((p) => {
          if (p.direction === 'down') {
            p.x += p.speed;
            if (p.x > width - 40) p.x = 40;
          } else {
            p.x -= p.speed * 0.7;
            if (p.x < 40) p.x = width - 40;
          }

          // Check if packet is inside encrypted tunnel
          const inTunnel = p.x >= tunnelStart && p.x <= tunnelEnd;
          p.color = inTunnel ? '#a855f7' : p.direction === 'down' ? '#38bdf8' : '#34d399';
          p.glow = inTunnel ? 'rgba(168, 85, 247, 0.8)' : 'rgba(56, 189, 248, 0.7)';

          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.glow;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        });
      } else if (isDisconnected) {
        // Disconnected red indicator in center
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.moveTo(width / 2 - 30, height / 2);
        ctx.lineTo(width / 2 + 30, height / 2);
        ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [isConnected, isDegraded, isDisconnected, metrics.downloadMbps]);

  return (
    <div
      className="glass-panel"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '1.75rem 1.75rem 1.25rem',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.75) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: isDisconnected
          ? '1px solid rgba(239, 68, 68, 0.4)'
          : isDegraded
          ? '1px solid rgba(245, 158, 11, 0.4)'
          : '1px solid rgba(59, 130, 246, 0.35)',
        boxShadow: isDisconnected
          ? '0 8px 32px -4px rgba(239, 68, 68, 0.2)'
          : '0 8px 32px -4px rgba(59, 130, 246, 0.15)',
      }}
    >
      {/* Top Banner Status Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isDisconnected
                ? 'rgba(239, 68, 68, 0.15)'
                : isDegraded
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${
                isDisconnected
                  ? 'rgba(239, 68, 68, 0.4)'
                  : isDegraded
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'rgba(16, 185, 129, 0.4)'
              }`,
            }}
          >
            {isDisconnected ? (
              <ShieldAlert size={20} color="var(--color-danger)" />
            ) : (
              <ShieldCheck size={20} color={isDegraded ? 'var(--color-warning)' : 'var(--color-success)'} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Live VPN Tunnel Pipeline
              </h2>
              <span
                className={`badge ${
                  isDisconnected ? 'badge-error' : isDegraded ? 'badge-warning' : 'badge-success'
                }`}
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
              >
                ● {state}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {statusMessage || 'Encrypted wire-speed transport stream active'}
            </p>
          </div>
        </div>

        {/* Reconnect Sequence Bar if applicable */}
        {isConnecting && (
          <div
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontSize: '0.8rem',
              color: 'var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <Radio size={16} className="animate-pulse" />
            <span>{reconnectStep || 'Configuring secure tunnel...'}</span>
            <span style={{ fontWeight: 700 }}>{reconnectProgress}%</span>
          </div>
        )}

        {/* Kill Switch Banner if Disconnected */}
        {isDisconnected && settings.killSwitchActive && (
          <div
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: 'var(--color-danger)',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Lock size={14} />
            INTERNET BLOCKED BY KILL SWITCH (LEAK SHIELD ACTIVE)
          </div>
        )}
      </div>

      {/* Visual 5-Stage Network Nodes */}
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1rem',
          margin: '0.5rem 0 1.5rem',
          zIndex: 2,
        }}
        className="tunnel-nodes-container"
      >
        {/* Node 1: Device / Application */}
        <div className="tunnel-node-card">
          <div className="node-icon-wrapper bg-blue">
            <Laptop size={20} color="#38bdf8" />
          </div>
          <div className="node-title">Laptop Workstation</div>
          <div className="node-subtitle font-mono">192.168.1.20</div>
          <div className="node-tag">Local Device</div>
        </div>

        {/* Node 2: Local Gateway */}
        <div className="tunnel-node-card">
          <div className="node-icon-wrapper bg-slate">
            <Router size={20} color="#94a3b8" />
          </div>
          <div className="node-title">Local Gateway</div>
          <div className="node-subtitle font-mono">192.168.1.1</div>
          <div className="node-tag">eth0 / Router</div>
        </div>

        {/* Node 3: Encrypted VPN Tunnel (Hero Core) */}
        <div className="tunnel-node-card highlight-tunnel">
          <div className="node-icon-wrapper bg-purple">
            <Lock size={22} color="#c084fc" />
          </div>
          <div className="node-title" style={{ color: '#c084fc' }}>
            {settings.protocol.toUpperCase()} Tunnel
          </div>
          <div className="node-subtitle font-mono" style={{ color: '#f8fafc' }}>
            {settings.interfaceName} • {settings.vpnIP}
          </div>
          <div className="node-tag" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe' }}>
            {settings.encryption}
          </div>
        </div>

        {/* Node 4: VPN Provider Server */}
        <div className="tunnel-node-card">
          <div className="node-icon-wrapper bg-emerald">
            <Server size={20} color="#34d399" />
          </div>
          <div className="node-title">{settings.serverName}</div>
          <div className="node-subtitle font-mono">
            {settings.serverCity}, {settings.serverCountry}
          </div>
          <div className="node-tag">{settings.provider}</div>
        </div>

        {/* Node 5: Public Internet */}
        <div className="tunnel-node-card">
          <div className="node-icon-wrapper bg-cyan">
            <Globe size={20} color="#22d3ee" />
          </div>
          <div className="node-title">Public Internet</div>
          <div className="node-subtitle font-mono" style={{ color: '#38bdf8' }}>
            {settings.publicIP}
          </div>
          <div className="node-tag">Exit Gateway</div>
        </div>
      </div>

      {/* 60 FPS Particle Canvas Stream Overlay */}
      <div
        style={{
          position: 'relative',
          height: '110px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          marginBottom: '1.25rem',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* Flow Labels Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '16px',
            right: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        >
          <span>LAN Sockets (Plaintext)</span>
          <span style={{ color: '#c084fc', fontWeight: 600 }}>
            ════ Encrypted WireGuard Envelope (ChaCha20-Poly1305) ════
          </span>
          <span>WAN Routing (Exit Node)</span>
        </div>
      </div>

      {/* Live Telemetry HUD Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {/* Metric 1: Download */}
        <div className="telemetry-pill">
          <div className="pill-header">
            <ArrowDown size={14} color="#38bdf8" />
            <span>Download</span>
          </div>
          <div className="pill-value font-mono" style={{ color: '#38bdf8' }}>
            {metrics.downloadMbps.toFixed(1)} <span className="pill-unit">Mbps</span>
          </div>
        </div>

        {/* Metric 2: Upload */}
        <div className="telemetry-pill">
          <div className="pill-header">
            <ArrowUp size={14} color="#34d399" />
            <span>Upload</span>
          </div>
          <div className="pill-value font-mono" style={{ color: '#34d399' }}>
            {metrics.uploadMbps.toFixed(1)} <span className="pill-unit">Mbps</span>
          </div>
        </div>

        {/* Metric 3: Packet Rate */}
        <div className="telemetry-pill">
          <div className="pill-header">
            <Activity size={14} color="#818cf8" />
            <span>Packet Rate</span>
          </div>
          <div className="pill-value font-mono">
            {metrics.packetsPerSec.toLocaleString()} <span className="pill-unit">pkts/s</span>
          </div>
        </div>

        {/* Metric 4: Latency */}
        <div className="telemetry-pill">
          <div className="pill-header">
            <Zap size={14} color={metrics.latencyMs > 100 ? '#f59e0b' : '#38bdf8'} />
            <span>Latency</span>
          </div>
          <div
            className="pill-value font-mono"
            style={{ color: metrics.latencyMs > 100 ? '#f59e0b' : '#f8fafc' }}
          >
            {metrics.latencyMs} <span className="pill-unit">ms</span>
          </div>
        </div>

        {/* Metric 5: Active Connections */}
        <div className="telemetry-pill">
          <div className="pill-header">
            <Radio size={14} color="#cbd5e1" />
            <span>Connections</span>
          </div>
          <div className="pill-value font-mono">{metrics.activeConnections}</div>
        </div>

        {/* Metric 6: Packet Loss */}
        <div className="telemetry-pill">
          <div className="pill-header">
            <span>Packet Loss</span>
          </div>
          <div
            className="pill-value font-mono"
            style={{ color: metrics.packetLossPercent > 1.0 ? '#ef4444' : '#10b981' }}
          >
            {metrics.packetLossPercent.toFixed(1)}%
          </div>
        </div>

        {/* Metric 7: Uptime */}
        <div className="telemetry-pill">
          <div className="pill-header">
            <Clock size={14} color="#94a3b8" />
            <span>Tunnel Uptime</span>
          </div>
          <div className="pill-value font-mono">{formatUptime(metrics.uptimeSeconds)}</div>
        </div>
      </div>

      <style>{`
        .tunnel-nodes-container {
          grid-template-columns: repeat(5, 1fr);
        }
        @media (max-width: 900px) {
          .tunnel-nodes-container {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .tunnel-node-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 1rem 0.75rem;
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          backdrop-filter: blur(8px);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .tunnel-node-card:hover {
          transform: translateY(-2px);
          border-color: var(--border-medium);
        }
        .tunnel-node-card.highlight-tunnel {
          background: linear-gradient(180deg, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.05) 100%);
          border: 1px solid rgba(168, 85, 247, 0.35);
          box-shadow: 0 0 20px -3px rgba(168, 85, 247, 0.2);
        }
        .node-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.6rem;
        }
        .node-icon-wrapper.bg-blue { background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); }
        .node-icon-wrapper.bg-slate { background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.25); }
        .node-icon-wrapper.bg-purple { background: rgba(168, 85, 247, 0.18); border: 1px solid rgba(168, 85, 247, 0.35); }
        .node-icon-wrapper.bg-emerald { background: rgba(52, 211, 153, 0.12); border: 1px solid rgba(52, 211, 153, 0.25); }
        .node-icon-wrapper.bg-cyan { background: rgba(34, 211, 238, 0.12); border: 1px solid rgba(34, 211, 238, 0.25); }
        .node-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .node-subtitle {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-bottom: 0.45rem;
        }
        .node-tag {
          font-size: 0.68rem;
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-sm);
          background-color: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          font-weight: 500;
        }
        .telemetry-pill {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .pill-header {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .pill-value {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .pill-unit {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 400;
        }
      `}</style>
    </div>
  );
};
