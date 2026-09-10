import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Power,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Lock,
  Radio,
  Zap,
} from 'lucide-react';
import { TunnelState, VPNSettings } from '../../types/vpn';

interface ConnectionStatusCardProps {
  state: TunnelState;
  settings: VPNSettings;
  statusMessage?: string;
  onDisconnect: () => void;
  onReconnect: () => void;
  onConnect: () => void;
  onSwitchServer: () => void;
  isLoading?: boolean;
}

export const ConnectionStatusCard: React.FC<ConnectionStatusCardProps> = ({
  state,
  settings,
  statusMessage,
  onDisconnect,
  onReconnect,
  onConnect,
  onSwitchServer,
  isLoading = false,
}) => {
  const [showRealIP, setShowRealIP] = useState(false);
  const [copiedVPNIP, setCopiedVPNIP] = useState(false);

  const isConnected = state === 'connected';
  const isConnecting = state === 'connecting' || state === 'reconnecting';


  const copyVPNIP = () => {
    navigator.clipboard.writeText(settings.publicIP);
    setCopiedVPNIP(true);
    setTimeout(() => setCopiedVPNIP(false), 2000);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        position: 'relative',
        overflow: 'hidden',
        borderLeft: isConnected
          ? '4px solid var(--color-success)'
          : isConnecting
          ? '4px solid var(--accent-cyan)'
          : '4px solid var(--color-danger)',
      }}
    >
      {/* Header with Title and Control Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isConnected
                ? 'rgba(16, 185, 129, 0.15)'
                : isConnecting
                ? 'rgba(6, 182, 212, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              color: isConnected
                ? 'var(--color-success)'
                : isConnecting
                ? 'var(--accent-cyan)'
                : 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isConnected ? '0 0 16px rgba(16, 185, 129, 0.25)' : 'none',
            }}
          >
            {isConnected ? (
              <ShieldCheck size={26} />
            ) : isConnecting ? (
              <RefreshCw size={26} className="spin" />
            ) : (
              <ShieldAlert size={26} />
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Tunnel Status:{' '}
                <span
                  style={{
                    color: isConnected
                      ? 'var(--color-success)'
                      : isConnecting
                      ? 'var(--accent-cyan)'
                      : 'var(--color-danger)',
                    textTransform: 'uppercase',
                  }}
                >
                  {state}
                </span>
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {statusMessage || (isConnected
                ? `Protected via ${settings.provider} (${settings.protocol.toUpperCase()})`
                : 'Unprotected - Kill Switch blocking non-VPN leaks')}
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={onDisconnect}
                disabled={isLoading}
                className="btn btn-danger"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
              >
                <Power size={15} />
                Disconnect
              </button>
              <button
                type="button"
                onClick={onReconnect}
                disabled={isLoading}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
              >
                <RefreshCw size={15} />
                Reconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={isLoading}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
            >
              <Zap size={15} />
              Connect Tunnel
            </button>
          )}

          <button
            type="button"
            onClick={onSwitchServer}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
          >
            Switch Server
          </button>
        </div>
      </div>

      {/* IP Masking & Anonymity Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
        }}
      >
        {/* Real ISP IP (Hidden) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              ORIGIN ISP ADDRESS (PHYSICAL)
            </span>
            <button
              type="button"
              onClick={() => setShowRealIP(!showRealIP)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.7rem',
              }}
            >
              {showRealIP ? <EyeOff size={13} /> : <Eye size={13} />}
              {showRealIP ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              className="font-mono"
              style={{
                fontSize: '1rem',
                color: isConnected ? 'var(--text-muted)' : 'var(--color-danger)',
                textDecoration: isConnected ? 'line-through' : 'none',
              }}
            >
              {showRealIP ? settings.realISP_IP : '•••.•••.•••.•••'}
            </span>
            {isConnected && (
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.4rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--color-success)',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                MASKED
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Local Router Gateway • Direct traffic blocked
          </div>
        </div>

        {/* Public VPN IP (Active) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              PUBLIC VPN EXIT IP (ANONYMIZED)
            </span>
            {isConnected && (
              <button
                type="button"
                onClick={copyVPNIP}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.7rem',
                }}
              >
                {copiedVPNIP ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                {copiedVPNIP ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              className="font-mono"
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: isConnected ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}
            >
              {isConnected ? settings.publicIP : 'Unavailable'}
            </span>
            {isConnected && (
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.4rem',
                  backgroundColor: 'rgba(6, 182, 212, 0.15)',
                  color: 'var(--accent-cyan)',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                PUBLIC
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {settings.serverCity}, {settings.serverCountry} ({settings.provider})
          </div>
        </div>
      </div>

      {/* Security Engine & Handshake Telemetry */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={15} color="var(--color-success)" />
          <span>
            Kill Switch:{' '}
            <strong style={{ color: settings.killSwitchActive ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {settings.killSwitchActive ? 'ACTIVE (Strict DROP)' : 'INACTIVE'}
            </strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={15} color="var(--accent-indigo)" />
          <span>
            Kernel Interface:{' '}
            <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>
              {settings.interfaceName}
            </strong>{' '}
            (assigned {settings.vpnIP})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--color-success)' : 'var(--text-muted)',
            }}
          />
          <span>
            Noise Protocol Handshake:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {isConnected ? `${settings.handshakeAgoSeconds}s ago` : 'N/A'}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
