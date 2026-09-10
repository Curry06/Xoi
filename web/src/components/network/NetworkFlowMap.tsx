import React, { useState } from 'react';
import { Laptop, Router, Shield, Lock, Server, Compass, Globe, X, ChevronRight } from 'lucide-react';
import { NetworkFlowNode, TunnelState, VPNSettings } from '../../types/vpn';

interface NetworkFlowMapProps {
  state: TunnelState;
  settings: VPNSettings;
  firewallStats: {
    allowedCount: number;
    blockedCount: number;
    droppedCount: number;
    rulesCount: number;
  };
  dnsMetrics: {
    provider: string;
    serverAddress: string;
    queriesPerMin: number;
    blockedPerMin: number;
    avgResponseMs: number;
    lastQueryDomain: string;
  };
  latencyMs: number;
}

export const NetworkFlowMap: React.FC<NetworkFlowMapProps> = ({
  state,
  settings,
  firewallStats,
  dnsMetrics,
  latencyMs,
}) => {
  const [selectedNode, setSelectedNode] = useState<NetworkFlowNode | null>(null);

  const isConnected = state === 'connected';
  const isDegraded = state === 'degraded';
  const isDisconnected = state === 'disconnected' || state === 'blocked';

  const nodes: NetworkFlowNode[] = [
    {
      id: 'device',
      name: 'Device',
      subtitle: 'Client Host',
      status: 'healthy',
      statusText: 'Healthy',
      ip: '192.168.1.20',
      metric: 'Workstation',
      details: {
        'Operating System': 'Linux 6.8 (x86_64)',
        'Local IP': '192.168.1.20',
        'MAC Address': 'BC:D0:74:12:34:56',
        'Network Interface': 'wlan0 / eth0',
        'Active Sockets': 47,
        'MTU Configuration': 1500,
        'DHCP Lease': 'Valid (22h remaining)',
      },
    },
    {
      id: 'router',
      name: 'Router',
      subtitle: 'Local Gateway',
      status: 'healthy',
      statusText: 'Healthy',
      ip: '192.168.1.1',
      metric: '0.4 ms RTT',
      details: {
        'Gateway IP': '192.168.1.1',
        'Subnet': '192.168.1.0/24',
        'LAN Latency': '0.4 ms',
        'NAT Acceleration': 'Enabled',
        'Packet Drops (LAN)': '0.0%',
        'Port Forward WAN': 'Inactive (Bypassed by VPN)',
      },
    },
    {
      id: 'firewall',
      name: 'Firewall',
      subtitle: 'iptables Kill Switch',
      status: isDisconnected ? 'blocked' : 'active',
      statusText: isDisconnected ? 'Blocked (Drop)' : 'Active',
      ip: 'Docker Netfilter',
      metric: `${firewallStats.blockedCount} Blocked`,
      details: {
        'Firewall Status': isDisconnected ? 'ACTIVE (BLOCKING NON-VPN TRAFFIC)' : 'Active & Enforcing',
        'Default Policy': 'DROP (Leak Shield)',
        'Allowed Outbound Packets': firewallStats.allowedCount,
        'Blocked External Requests': firewallStats.blockedCount,
        'Dropped Inbound WAN Probes': firewallStats.droppedCount,
        'Loaded Kernel Rules': firewallStats.rulesCount,
        'Kill-Switch Invariant': 'Enforced (No Leaks Allowed)',
      },
    },
    {
      id: 'vpn_tunnel',
      name: settings.protocol === 'wireguard' ? 'WireGuard' : 'OpenVPN',
      subtitle: settings.interfaceName,
      status: isDisconnected ? 'error' : isDegraded ? 'warning' : 'healthy',
      statusText: isDisconnected ? 'Disconnected' : isDegraded ? 'Degraded' : 'Connected',
      ip: settings.vpnIP,
      metric: settings.encryption,
      details: {
        'Protocol': settings.protocol.toUpperCase(),
        'Tunnel Interface': settings.interfaceName,
        'Internal Tunnel IP': settings.vpnIP,
        'Encryption Suite': settings.encryption,
        'Handshake Timer': `${settings.handshakeAgoSeconds}s ago`,
        'Active MTU / MSS': '1280 / 1200',
        'NAT-PMP Port Forward': `${settings.portForwarded} -> :${settings.internalPort}`,
      },
    },
    {
      id: 'vpn_server',
      name: 'VPN Server',
      subtitle: settings.serverName,
      status: isDisconnected ? 'error' : isDegraded ? 'warning' : 'healthy',
      statusText: isDisconnected ? 'Unreachable' : isDegraded ? 'High Latency' : 'Healthy',
      ip: settings.serverIP,
      metric: `${latencyMs} ms`,
      details: {
        'Provider': settings.provider,
        'Server Name': settings.serverName,
        'Location': `${settings.serverCity}, ${settings.serverCountry}`,
        'Server IP': settings.serverIP,
        'Tunnel Ping Latency': `${latencyMs} ms`,
        'Server Capacity Load': `${settings.serverLoadPercent}%`,
        'WireGuard Peer Status': isConnected ? 'Active (Keepalive 25s)' : 'Down',
      },
    },
    {
      id: 'dns',
      name: 'DNS Shield',
      subtitle: dnsMetrics.provider,
      status: 'healthy',
      statusText: 'Healthy',
      ip: dnsMetrics.serverAddress,
      metric: `${dnsMetrics.avgResponseMs} ms`,
      details: {
        'DNS Resolver': dnsMetrics.provider,
        'Upstream Address': `${dnsMetrics.serverAddress} (DoT / Port 853)`,
        'Queries Handled': `${dnsMetrics.queriesPerMin}/min`,
        'Malicious/Ads Blocked': `${dnsMetrics.blockedPerMin}/min`,
        'Avg Response Time': `${dnsMetrics.avgResponseMs} ms`,
        'Last Query Domain': dnsMetrics.lastQueryDomain,
        'DNS Leak Interception': 'Active & Verified',
      },
    },
    {
      id: 'internet',
      name: 'Internet',
      subtitle: 'Target WAN',
      status: isDisconnected ? 'blocked' : 'healthy',
      statusText: isDisconnected ? 'Blocked' : 'Reachable',
      ip: settings.publicIP,
      metric: 'Exit Node',
      details: {
        'Exit Public IP': settings.publicIP,
        'ISP Provider Masked': settings.realISP_IP,
        'Origin Country': settings.serverCountry,
        'BGP Routing Status': isConnected ? 'Optimal' : 'Severed by Kill-Switch',
        'DNS Leak Status': '0 leaks detected (Secure)',
        'IPv6 Leak Protection': 'Disabled / Dropped by Policy',
      },
    },
  ];

  const getStatusColor = (status: NetworkFlowNode['status']) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return 'var(--color-success)';
      case 'warning':
        return 'var(--color-warning)';
      case 'error':
      case 'blocked':
        return 'var(--color-danger)';
    }
  };

  const getNodeIcon = (id: string) => {
    switch (id) {
      case 'device':
        return <Laptop size={18} />;
      case 'router':
        return <Router size={18} />;
      case 'firewall':
        return <Shield size={18} />;
      case 'vpn_tunnel':
        return <Lock size={18} />;
      case 'vpn_server':
        return <Server size={18} />;
      case 'dns':
        return <Compass size={18} />;
      case 'internet':
      default:
        return <Globe size={18} />;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={18} color="var(--accent-indigo)" />
            Network Topology & End-to-End Pipeline
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Real-time status of each architectural layer. Click any component to inspect telemetry and routing rules.
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Click node to inspect
        </div>
      </div>

      {/* Pipeline Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.5rem',
          alignItems: 'stretch',
        }}
        className="flow-map-container"
      >
        {nodes.map((node, index) => {
          const isSelected = selectedNode?.id === node.id;
          const statusColor = getStatusColor(node.status);

          return (
            <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setSelectedNode(node)}
                style={{
                  flex: 1,
                  padding: '0.85rem 0.6rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSelected
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected
                    ? '1px solid var(--accent-indigo)'
                    : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  width: '100%',
                }}
                className="flow-node-button"
              >
                {/* Status Dot Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: statusColor, display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 600 }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }} />
                    {node.statusText}
                  </span>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {getNodeIcon(node.id)}
                  </div>
                </div>

                {/* Node Name */}
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {node.name}
                </div>

                {/* Subtitle / IP */}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {node.ip || node.subtitle}
                </div>

                {/* Quick Metric Badge */}
                {node.metric && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', fontWeight: 500, marginTop: '0.2rem' }}>
                    {node.metric}
                  </div>
                )}
              </button>

              {/* Chevron Arrow to next node */}
              {index < nodes.length - 1 && (
                <div style={{ color: 'var(--border-medium)', display: 'flex', alignItems: 'center' }} className="flow-chevron">
                  <ChevronRight size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inspector Modal / Slide-down Drawer */}
      {selectedNode && (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                }}
              >
                {getNodeIcon(selectedNode.id)}
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedNode.name} Inspector
                  <span style={{ fontSize: '0.75rem', color: getStatusColor(selectedNode.status), fontWeight: 600 }}>
                    ● {selectedNode.statusText}
                  </span>
                </h4>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Architectural component telemetry & live invariants
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.3rem',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Details Key-Value Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {Object.entries(selectedNode.details).map(([key, val]) => (
              <div
                key={key}
                style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  {key}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: typeof val === 'number' || String(val).includes('.') ? 'var(--font-mono)' : 'inherit' }}>
                  {String(val)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .flow-map-container {
            grid-template-columns: 1fr !fr !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .flow-chevron {
            display: none !important;
          }
        }
        .flow-node-button:hover {
          transform: translateY(-1px);
          border-color: var(--border-medium) !important;
        }
      `}</style>
    </div>
  );
};
