import React, { useState } from 'react';
import {
  Shield,
  Globe,
  Radio,
  Network,
  Layers,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  WifiOff,
  AlertTriangle,
  Menu,
  Route,
  ShieldAlert,
  ShieldCheck,
  Compass,
  Laptop,
  Cpu,
  Sliders,
  Clock,
  Share2,
} from 'lucide-react';
import { LiveSnapshot } from '../types';
import { TunnelState, VPNSettings, TunnelMetrics } from '../types/vpn';
import { getStateBadgeClass } from '../hooks/useLiveState';

interface DashboardLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  snapshot: LiveSnapshot;
  vpnState?: TunnelState;
  vpnSettings?: VPNSettings;
  vpnMetrics?: TunnelMetrics;
  isOffline: boolean;
  isStale: boolean;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentPath,
  onNavigate,
  snapshot,
  vpnState,
  vpnSettings,
  vpnMetrics,
  isOffline,
  isStale,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const navItems = [
    { path: '/overview', label: 'Overview', icon: Shield },
    { path: '/traffic', label: 'Live Traffic', icon: Activity },
    { path: '/connections', label: 'Connections', icon: Layers },
    { path: '/network', label: 'Network Map', icon: Network },
    { path: '/routing', label: 'Kernel Routing', icon: Route },
    { path: '/firewall', label: 'Firewall & Killswitch', icon: ShieldAlert },
    { path: '/dns', label: 'DNS Shield', icon: Compass },
    { path: '/devices', label: 'LAN Clients', icon: Laptop },
    { path: '/servers', label: 'Servers', icon: Globe },
    { path: '/port-forwarding', label: 'Port Forwarding', icon: Radio },
    { path: '/applications', label: 'Public Applications', icon: Share2 },
    { path: '/security', label: 'Security Log', icon: ShieldCheck },
    { path: '/system', label: 'System Health', icon: Cpu },
    { path: '/profiles', label: 'Profiles', icon: Sliders },
    { path: '/activity', label: 'Engine Activity', icon: Clock },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const effectiveState = vpnState || (snapshot.state as TunnelState) || 'connected';

  const getDotClass = (state: string) => {
    switch (state) {
      case 'connected':
        return 'dot-connected';
      case 'connecting':
      case 'reconnecting':
        return 'dot-connecting';
      case 'disconnected':
      case 'blocked':
        return 'dot-disconnected';
      case 'degraded':
        return 'dot-degraded';
      default:
        return 'dot-error';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Desktop Sidebar */}
      <aside
        style={{
          width: isCollapsed ? '72px' : '240px',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        className="desktop-sidebar"
      >
        {/* Brand Header */}
        <div
          style={{
            height: '68px',
            minHeight: '68px',
            padding: isCollapsed ? '0 1rem' : '0 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--bg-sidebar)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Shield size={20} />
            </div>
            {!isCollapsed && (
              <div style={{ lineHeight: '1.2' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                  Gluetun
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                  VPN Control Plane
                </div>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
              }}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {isCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
            <button
              onClick={() => setIsCollapsed(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
              aria-label="Expand sidebar"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Navigation links */}
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <button
                key={item.path}
                onClick={() => {
                  onNavigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: isCollapsed ? '0.6rem 0' : '0.55rem 0.75rem',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={18} color={isActive ? 'var(--accent-indigo)' : 'currentColor'} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Engine status mini footer */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          {!isCollapsed ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <span className={`status-dot ${getDotClass(effectiveState)}`} />
                <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                  {effectiveState}
                </span>
              </div>
              <div>Kernel {vpnSettings?.interfaceName || 'tun0'} • {vpnSettings?.protocol?.toUpperCase() || 'WIREGUARD'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span className={`status-dot ${getDotClass(effectiveState)}`} />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            height: '68px',
            backgroundColor: 'var(--bg-app)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="mobile-menu-btn"
              style={{
                display: 'none',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              aria-label="Open mobile menu"
            >
              <Menu size={22} />
            </button>

            {/* Breadcrumb / Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                {navItems.find((n) => n.path === currentPath)?.label || 'Overview'}
              </div>
            </div>
          </div>

          {/* Topbar Telemetry Ribbon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Quick Live Stats (Google Cloud NOC bar) */}
            {vpnSettings && (
              <div
                className="desktop-stat-ribbon"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  padding: '0.35rem 0.85rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Node: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{vpnSettings.serverName}</strong>
                </div>

                <div style={{ height: '12px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Exit IP: </span>
                  <strong className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                    {vpnSettings.publicIP}
                  </strong>
                </div>

                <div style={{ height: '12px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Proto: </span>
                  <strong style={{ color: 'var(--accent-indigo)' }}>
                    {vpnSettings.protocol.toUpperCase()}
                  </strong>
                </div>

                {vpnMetrics && (
                  <>
                    <div style={{ height: '12px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>RTT: </span>
                      <strong style={{ color: vpnMetrics.latencyMs > 100 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {vpnMetrics.latencyMs}ms
                      </strong>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Offline Alert */}
            {isOffline && (
              <span className="badge badge-error" style={{ gap: '0.3rem' }}>
                <WifiOff size={13} />
                Offline
              </span>
            )}

            {/* Stale Data Alert */}
            {!isOffline && isStale && (
              <span className="badge badge-degraded" style={{ gap: '0.3rem' }}>
                <AlertTriangle size={13} />
                Stale Data
              </span>
            )}

            {/* Live State Badge */}
            <span className={`badge ${getStateBadgeClass(effectiveState as any)}`}>
              <span className={`status-dot ${getDotClass(effectiveState)}`} />
              {effectiveState}
            </span>

            {/* Light/Dark Toggle */}
            <button
              onClick={toggleTheme}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: '0.45rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* Mobile Nav Overlay */}
        {isMobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
            }}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div
              style={{
                width: '260px',
                backgroundColor: 'var(--bg-sidebar)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--accent-indigo)' }}>
                Gluetun Control Plane
              </div>
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    onNavigate(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`btn ${currentPath === item.path ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.825rem' }}
                >
                  <item.icon size={17} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Page Content Viewport */}
        <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
