export type ProtocolType = 'wireguard' | 'openvpn' | 'amneziawg';

export type TunnelState =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'degraded'
  | 'blocked';

export interface TunnelMetrics {
  downloadMbps: number;
  uploadMbps: number;
  packetsPerSec: number;
  activeConnections: number;
  latencyMs: number;
  packetLossPercent: number;
  uptimeSeconds: number;
  peakMbps: number;
  averageMbps: number;
}

export interface VPNSettings {
  protocol: ProtocolType;
  interfaceName: string;
  vpnIP: string;
  publicIP: string;
  realISP_IP: string;
  serverName: string;
  serverCountry: string;
  serverCity: string;
  serverIP: string;
  provider: string;
  encryption: string;
  handshakeAgoSeconds: number;
  serverLoadPercent: number;
  portForwarded: number;
  internalPort: number;
  killSwitchActive: boolean;
}

export interface NetworkFlowNode {
  id: string;
  name: string;
  subtitle: string;
  status: 'healthy' | 'active' | 'warning' | 'error' | 'blocked';
  statusText: string;
  ip?: string;
  metric?: string;
  details: Record<string, string | number | boolean>;
}

export interface TrafficDataPoint {
  timestamp: string;
  download: number; // in Mbps
  upload: number;   // in Mbps
}

export interface AppTrafficItem {
  name: string;
  category: string;
  rateMbps: number;
  percentage: number;
  color: string;
  icon?: string;
}

export interface DestinationTrafficItem {
  id: string;
  destination: string;
  ip: string;
  protocol: string;
  downloadRate: string;
  uploadRate: string;
  connections: number;
  category: string;
}

export interface ActiveConnection {
  id: string;
  source: string;
  destination: string;
  port: number;
  protocol: 'TCP' | 'UDP' | 'DNS' | 'HTTPS';
  state: 'ESTABLISHED' | 'SYN_SENT' | 'TIME_WAIT' | 'CLOSE_WAIT' | 'BLOCKED';
  traffic: string;
  duration: string;
  action: 'ALLOWED' | 'BLOCKED';
}

export interface FirewallEvent {
  id: string;
  timestamp: string;
  source: string;
  destination: string;
  port: number;
  rule: string;
  action: 'ALLOW' | 'BLOCK' | 'DROP';
  reason?: string;
}

export interface DNSMetrics {
  provider: string;
  serverAddress: string;
  queriesPerMin: number;
  blockedPerMin: number;
  avgResponseMs: number;
  lastQueryDomain: string;
  lastQueryTime: string;
  leakProtected: boolean;
  history: { time: string; queries: number }[];
}

export interface RouteEntry {
  id: string;
  destination: string;
  gateway: string;
  interface: string;
  flags: string;
  metric: number;
  description: string;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  sourceComponent: string;
}

export interface DeviceTrafficItem {
  id: string;
  name: string;
  type: 'laptop' | 'mobile' | 'server' | 'docker' | 'iot';
  ip: string;
  mac: string;
  downloadMbps: number;
  uploadMbps: number;
  connections: number;
  active: boolean;
}

export interface SystemHealthMetrics {
  cpuUsagePercent: number;
  memoryUsageGB: number;
  memoryTotalGB: number;
  diskUsageGB: number;
  diskTotalGB: number;
  goroutinesCount: number;
  hostUptimeSeconds: number;
  services: {
    name: string;
    status: 'running' | 'stopped' | 'degraded';
    details: string;
  }[];
}

export type ScenarioID =
  | 'normal'
  | 'large_download'
  | 'vpn_latency'
  | 'tunnel_disconnect'
  | 'vpn_reconnect'
  | 'dns_leak'
  | 'public_ip_change'
  | 'firewall_activity'
  | 'server_change'
  | 'multi_device';

export interface DemoScenario {
  id: ScenarioID;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  color: string;
}
