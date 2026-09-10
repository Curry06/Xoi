import type {
  TunnelMetrics,
  VPNSettings,
  TrafficDataPoint,
  AppTrafficItem,
  DestinationTrafficItem,
  ActiveConnection,
  FirewallEvent,
  DNSMetrics,
  RouteEntry,
  SecurityEvent,
  DeviceTrafficItem,
  SystemHealthMetrics,
  ScenarioID,
  TunnelState,
} from '../types/vpn.ts';

export class SimulationEngine {
  private currentScenario: ScenarioID = 'normal';
  private timer: any = null;
  public destroy(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  private subscribers: Set<(state: any) => void> = new Set();
  private isSimulationActive: boolean = true;

  // Live State
  private state: TunnelState = 'connected';
  private statusMessage: string = 'Tunnel established and verified';
  private reconnectStep: string = '';
  private reconnectProgress: number = 100;

  // Base Settings
  private vpnSettings: VPNSettings = {
    protocol: 'wireguard',
    interfaceName: 'wg0',
    vpnIP: '10.10.10.2',
    publicIP: '103.22.200.32',
    realISP_IP: '49.37.102.14',
    serverName: 'Mumbai #03',
    serverCountry: 'India',
    serverCity: 'Mumbai',
    serverIP: '185.156.46.24',
    provider: 'ProtonVPN',
    encryption: 'ChaCha20-Poly1305',
    handshakeAgoSeconds: 14,
    serverLoadPercent: 42,
    portForwarded: 56038,
    internalPort: 8080,
    killSwitchActive: true,
  };

  // Metrics
  private metrics: TunnelMetrics = {
    downloadMbps: 42.6,
    uploadMbps: 8.4,
    packetsPerSec: 1842,
    activeConnections: 47,
    latencyMs: 32,
    packetLossPercent: 0.1,
    uptimeSeconds: 13336, // ~03:42:16
    peakMbps: 76.4,
    averageMbps: 31.5,
  };

  // Traffic time series
  private trafficHistory: TrafficDataPoint[] = [];

  // Apps
  private appTraffic: AppTrafficItem[] = [
    { name: 'Chrome', category: 'Web Browser', rateMbps: 18.4, percentage: 43, color: '#3b82f6' },
    { name: 'YouTube', category: 'Streaming Video', rateMbps: 10.2, percentage: 24, color: '#ef4444' },
    { name: 'Discord', category: 'Voice & Chat', rateMbps: 4.1, percentage: 10, color: '#8b5cf6' },
    { name: 'System / OS', category: 'Background Sync', rateMbps: 2.8, percentage: 7, color: '#64748b' },
    { name: 'Other Services', category: 'Encrypted P2P', rateMbps: 6.9, percentage: 16, color: '#10b981' },
  ];

  // Destinations
  private destinations: DestinationTrafficItem[] = [
    { id: 'dst-1', destination: 'YouTube CDN', ip: '142.250.190.46', protocol: 'HTTPS / QUIC', downloadRate: '12.4 Mbps', uploadRate: '1.2 Mbps', connections: 8, category: 'Video Streaming' },
    { id: 'dst-2', destination: 'GitHub API & Git', ip: '140.82.121.4', protocol: 'HTTPS', downloadRate: '2.1 Mbps', uploadRate: '340 Kbps', connections: 4, category: 'Developer Tools' },
    { id: 'dst-3', destination: 'Cloudflare Edge', ip: '104.16.132.229', protocol: 'HTTPS', downloadRate: '1.7 Mbps', uploadRate: '180 Kbps', connections: 12, category: 'CDN / Security' },
    { id: 'dst-4', destination: 'Google Services', ip: '142.250.196.78', protocol: 'HTTPS', downloadRate: '4.6 Mbps', uploadRate: '800 Kbps', connections: 7, category: 'Search & Cloud' },
    { id: 'dst-5', destination: 'AWS us-east-1', ip: '54.239.28.85', protocol: 'HTTPS', downloadRate: '3.2 Mbps', uploadRate: '620 Kbps', connections: 5, category: 'Cloud Infrastructure' },
  ];

  // Active Connections
  private connections: ActiveConnection[] = [
    { id: 'c-1', source: '10.10.10.2:51420', destination: '142.250.190.46:443', port: 443, protocol: 'HTTPS', state: 'ESTABLISHED', traffic: '14.8 MB', duration: '04:21', action: 'ALLOWED' },
    { id: 'c-2', source: '10.10.10.2:52310', destination: '140.82.121.4:443', port: 443, protocol: 'TCP', state: 'ESTABLISHED', traffic: '3.2 MB', duration: '12:04', action: 'ALLOWED' },
    { id: 'c-3', source: '10.10.10.2:48992', destination: '1.1.1.1:853', port: 853, protocol: 'DNS', state: 'ESTABLISHED', traffic: '182 KB', duration: '45:12', action: 'ALLOWED' },
    { id: 'c-4', source: '10.10.10.2:59012', destination: '104.16.132.229:443', port: 443, protocol: 'HTTPS', state: 'ESTABLISHED', traffic: '8.4 MB', duration: '02:15', action: 'ALLOWED' },
    { id: 'c-5', source: '10.10.10.2:34512', destination: '8.8.8.8:53', port: 53, protocol: 'DNS', state: 'BLOCKED', traffic: '0 B', duration: '00:01', action: 'BLOCKED' },
    { id: 'c-6', source: '10.10.10.2:60114', destination: '142.250.196.78:443', port: 443, protocol: 'TCP', state: 'ESTABLISHED', traffic: '5.6 MB', duration: '08:44', action: 'ALLOWED' },
    { id: 'c-7', source: '10.10.10.2:41208', destination: '185.156.46.24:51820', port: 51820, protocol: 'UDP', state: 'ESTABLISHED', traffic: '48.2 MB', duration: '03:42:16', action: 'ALLOWED' },
  ];

  // Firewall stats
  private firewallStats = {
    allowedCount: 2341,
    blockedCount: 184,
    droppedCount: 32,
    rulesCount: 28,
  };

  private firewallEvents: FirewallEvent[] = [
    { id: 'fe-1', timestamp: '20:14:05', source: '10.10.10.2', destination: '8.8.8.8', port: 53, rule: 'BLOCK_EXTERNAL_DNS', action: 'BLOCK', reason: 'DNS Leak Prevention active' },
    { id: 'fe-2', timestamp: '20:14:02', source: '10.10.10.2', destination: '185.156.46.24', port: 51820, rule: 'VPN_TUNNEL_OUT', action: 'ALLOW' },
    { id: 'fe-3', timestamp: '20:13:58', source: '192.168.1.34', destination: '1.1.1.1', port: 853, rule: 'ALLOW_DOT_RESOLVER', action: 'ALLOW' },
    { id: 'fe-4', timestamp: '20:13:42', source: '45.154.255.8', destination: '10.10.10.2', port: 22, rule: 'DROP_INBOUND_WAN', action: 'DROP', reason: 'Unsolicited inbound probe' },
    { id: 'fe-5', timestamp: '20:13:20', source: '10.10.10.2', destination: '142.250.190.46', port: 443, rule: 'ALLOW_TUNNEL_TCP', action: 'ALLOW' },
  ];

  // DNS
  private dnsMetrics: DNSMetrics = {
    provider: 'Cloudflare Zero Trust (DoT)',
    serverAddress: '1.1.1.1',
    queriesPerMin: 238,
    blockedPerMin: 14,
    avgResponseMs: 23,
    lastQueryDomain: 'google.com',
    lastQueryTime: '4s ago',
    leakProtected: true,
    history: [
      { time: '20:10', queries: 210 },
      { time: '20:11', queries: 224 },
      { time: '20:12', queries: 235 },
      { time: '20:13', queries: 248 },
      { time: '20:14', queries: 238 },
    ],
  };

  // Routes
  private routes: RouteEntry[] = [
    { id: 'r-1', destination: '0.0.0.0/0', gateway: '10.10.10.1', interface: 'wg0', flags: 'UG', metric: 50, description: 'Default route via encrypted WireGuard tunnel' },
    { id: 'r-2', destination: '10.10.10.0/24', gateway: '0.0.0.0', interface: 'wg0', flags: 'U', metric: 50, description: 'VPN Point-to-point subnet' },
    { id: 'r-3', destination: '192.168.1.0/24', gateway: '0.0.0.0', interface: 'eth0', flags: 'U', metric: 100, description: 'Local LAN Gateway bypass' },
    { id: 'r-4', destination: '172.25.0.0/16', gateway: '0.0.0.0', interface: 'docker0', flags: 'U', metric: 100, description: 'Internal container management bridge' },
    { id: 'r-5', destination: '185.156.46.24/32', gateway: '192.168.1.1', interface: 'eth0', flags: 'UGH', metric: 10, description: 'ProtonVPN Endpoint outer route' },
  ];

  // Security Events
  private securityEvents: SecurityEvent[] = [
    { id: 'se-1', timestamp: '20:14:05', title: 'Firewall Blocked External DNS Request', description: 'Application attempted unencrypted query to 8.8.8.8:53. Blocked to prevent DNS leak.', severity: 'CRITICAL', sourceComponent: 'Firewall' },
    { id: 'se-2', timestamp: '20:12:18', title: 'WireGuard Handshake Completed', description: 'Peer 185.156.46.24 authenticated with ChaCha20-Poly1305. RTT 32ms.', severity: 'INFO', sourceComponent: 'WireGuard' },
    { id: 'se-3', timestamp: '20:00:10', title: 'Public IP Transformed', description: 'Traffic re-routed from ISP (49.37.102.14) to ProtonVPN secure exit (103.22.200.32).', severity: 'INFO', sourceComponent: 'Routing' },
    { id: 'se-4', timestamp: '19:48:22', title: 'Kill Switch Verified Active', description: 'iptables rules prevent all outbound non-tunnel traffic on host interfaces.', severity: 'INFO', sourceComponent: 'Firewall' },
  ];

  // Multi Devices
  private devices: DeviceTrafficItem[] = [
    { id: 'dev-1', name: 'Work MacBook Pro', type: 'laptop', ip: '192.168.1.20', mac: 'BC:D0:74:12:34:56', downloadMbps: 24.0, uploadMbps: 4.8, connections: 24, active: true },
    { id: 'dev-2', name: 'iPhone 15 Pro', type: 'mobile', ip: '192.168.1.25', mac: 'F0:18:98:45:67:89', downloadMbps: 8.0, uploadMbps: 1.2, connections: 9, active: true },
    { id: 'dev-3', name: 'Home Media Server', type: 'server', ip: '192.168.1.50', mac: '70:85:C2:AB:CD:EF', downloadMbps: 11.0, uploadMbps: 2.1, connections: 8, active: true },
    { id: 'dev-4', name: 'Docker VPN Apps', type: 'docker', ip: '172.25.0.3', mac: '02:42:AC:19:00:03', downloadMbps: 4.0, uploadMbps: 0.3, connections: 5, active: true },
    { id: 'dev-5', name: 'Smart IoT Gateway', type: 'iot', ip: '192.168.1.80', mac: '94:E6:86:11:22:33', downloadMbps: 0.3, uploadMbps: 0.1, connections: 1, active: true },
  ];

  // System Host Health
  private systemHealth: SystemHealthMetrics = {
    cpuUsagePercent: 23,
    memoryUsageGB: 1.8,
    memoryTotalGB: 4.0,
    diskUsageGB: 14.2,
    diskTotalGB: 64.0,
    goroutinesCount: 184,
    hostUptimeSeconds: 1228800, // 14 days
    services: [
      { name: 'Gluetun Core Engine', status: 'running', details: 'v3.39.0 - container healthy' },
      { name: 'WireGuard Protocol Service', status: 'running', details: 'wg0 kernel module active' },
      { name: 'Firewall Kill Switch', status: 'running', details: 'DROP default policy enforced' },
      { name: 'DNS Resolver (DoT)', status: 'running', details: '1.1.1.1:853 validated' },
      { name: 'Control Server API', status: 'running', details: 'Internal bridge :8000 isolated' },
      { name: 'Metrics Collector', status: 'running', details: 'Sampling interval 1.0s' },
    ],
  };

  constructor() {
    this.initTrafficHistory();
    this.startLoop();
  }

  private initTrafficHistory() {
    const now = Date.now();
    for (let i = 60; i >= 0; i--) {
      const t = new Date(now - i * 1000);
      const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      // Gentle wave pattern around 35-45 Mbps
      const variation = Math.sin(i / 5) * 6 + (Math.random() * 4 - 2);
      this.trafficHistory.push({
        timestamp: timeStr,
        download: Math.max(1, +(42.6 + variation).toFixed(1)),
        upload: Math.max(0.5, +(8.4 + variation / 4).toFixed(1)),
      });
    }
  }

  private startLoop() {
    this.timer = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public setScenario(scenario: ScenarioID) {
    this.currentScenario = scenario;
    this.applyScenarioConfig(scenario);
    this.broadcast();
  }

  public getScenario(): ScenarioID {
    return this.currentScenario;
  }

  private applyScenarioConfig(scenario: ScenarioID) {
    switch (scenario) {
      case 'normal':
        this.state = 'connected';
        this.statusMessage = 'Tunnel established and verified (Normal Traffic)';
        this.metrics.downloadMbps = 42.6;
        this.metrics.uploadMbps = 8.4;
        this.metrics.latencyMs = 32;
        this.metrics.packetLossPercent = 0.1;
        this.metrics.packetsPerSec = 1842;
        this.metrics.activeConnections = 47;
        this.systemHealth.cpuUsagePercent = 23;
        this.vpnSettings.serverName = 'Mumbai #03';
        this.vpnSettings.serverCountry = 'India';
        this.vpnSettings.serverCity = 'Mumbai';
        this.vpnSettings.publicIP = '103.22.200.32';
        this.vpnSettings.killSwitchActive = true;
        break;

      case 'large_download':
        this.state = 'connected';
        this.statusMessage = 'High Bandwidth Activity Detected (Active Download)';
        this.metrics.downloadMbps = 85.4;
        this.metrics.uploadMbps = 2.4;
        this.metrics.latencyMs = 38;
        this.metrics.packetLossPercent = 0.2;
        this.metrics.packetsPerSec = 4920;
        this.metrics.activeConnections = 68;
        this.systemHealth.cpuUsagePercent = 42;
        this.appTraffic[0].rateMbps = 68.2; // Chrome downloading
        break;

      case 'vpn_latency':
        this.state = 'degraded';
        this.statusMessage = 'High Latency Detected on VPN Server (420 ms)';
        this.metrics.downloadMbps = 14.2;
        this.metrics.uploadMbps = 2.1;
        this.metrics.latencyMs = 420;
        this.metrics.packetLossPercent = 4.8;
        this.metrics.packetsPerSec = 820;
        this.securityEvents.unshift({
          id: `se-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          title: 'High VPN Tunnel Latency Alert',
          description: 'Tunnel ping to Mumbai #03 exceeded threshold: measured 420ms (packet loss 4.8%).',
          severity: 'WARNING',
          sourceComponent: 'WireGuard',
        });
        break;

      case 'tunnel_disconnect':
        this.state = 'disconnected';
        this.statusMessage = 'VPN Tunnel Lost — Kill Switch Active (Traffic Blocked)';
        this.metrics.downloadMbps = 0.0;
        this.metrics.uploadMbps = 0.0;
        this.metrics.packetsPerSec = 0;
        this.metrics.activeConnections = 0;
        this.metrics.latencyMs = 0;
        this.metrics.packetLossPercent = 100;
        this.vpnSettings.killSwitchActive = true;
        this.securityEvents.unshift({
          id: `se-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          title: 'VPN Tunnel Lost — Kill Switch Engaged',
          description: 'wg0 handshake timeout. Kill switch blocked all outbound Internet access to prevent leaks.',
          severity: 'CRITICAL',
          sourceComponent: 'Firewall',
        });
        break;

      case 'vpn_reconnect':
        this.state = 'reconnecting';
        this.statusMessage = 'Re-establishing WireGuard Secure Handshake...';
        this.reconnectProgress = 0;
        this.animateReconnection();
        break;

      case 'dns_leak':
        this.state = 'connected';
        this.statusMessage = 'DNS Leak Attempt Intercepted and Blocked';
        this.firewallStats.blockedCount += 1;
        this.firewallEvents.unshift({
          id: `fe-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          source: '10.10.10.2:48991',
          destination: '8.8.8.8:53',
          port: 53,
          rule: 'BLOCK_EXTERNAL_DNS',
          action: 'BLOCK',
          reason: 'Unauthorized external DNS query trapped by kill-switch',
        });
        this.securityEvents.unshift({
          id: `se-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          title: 'DNS Leak Attempt Blocked',
          description: 'Rogue query to 8.8.8.8:53 intercepted by iptables and dropped. Queries routed to 1.1.1.1.',
          severity: 'CRITICAL',
          sourceComponent: 'DNS Shield',
        });
        break;

      case 'public_ip_change':
        this.state = 'connected';
        this.statusMessage = 'Public Exit IP Transformation Complete';
        this.vpnSettings.realISP_IP = '49.37.102.14';
        this.vpnSettings.publicIP = '185.156.46.24';
        this.securityEvents.unshift({
          id: `se-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          title: 'Public IP Transformation Verified',
          description: 'ISP IP (49.37.102.14, India) securely masked. Visible exit: 185.156.46.24 (Proton AG).',
          severity: 'INFO',
          sourceComponent: 'IP Getter',
        });
        break;

      case 'firewall_activity':
        this.state = 'connected';
        this.statusMessage = 'Surge in Inbound Probes Blocked by Firewall';
        this.firewallStats.blockedCount += 12;
        this.firewallStats.droppedCount += 8;
        for (let i = 0; i < 3; i++) {
          this.firewallEvents.unshift({
            id: `fe-surge-${Date.now()}-${i}`,
            timestamp: new Date().toLocaleTimeString(),
            source: `198.51.100.${14 + i * 7}`,
            destination: '10.10.10.2',
            port: 8080 + i * 2,
            rule: 'DROP_UNSOLICITED',
            action: 'DROP',
            reason: 'Port scan attempt dropped on tun0',
          });
        }
        break;

      case 'server_change':
        this.state = 'reconnecting';
        this.statusMessage = 'Handover: Mumbai #03 -> Singapore #07';
        setTimeout(() => {
          this.state = 'connected';
          this.vpnSettings.serverName = 'Singapore #07';
          this.vpnSettings.serverCountry = 'Singapore';
          this.vpnSettings.serverCity = 'Singapore';
          this.vpnSettings.serverIP = '146.70.142.24';
          this.vpnSettings.publicIP = '146.70.142.85';
          this.metrics.latencyMs = 28;
          this.statusMessage = 'Connected to Singapore #07 (Latency: 28ms)';
          this.securityEvents.unshift({
            id: `se-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            title: 'Server Migration Completed',
            description: 'Seamless handover to Singapore #07. Route table and DNS cache refreshed.',
            severity: 'INFO',
            sourceComponent: 'VPN Manager',
          });
          this.broadcast();
        }, 1800);
        break;

      case 'multi_device':
        this.state = 'connected';
        this.statusMessage = 'Heavy Multi-Device Traffic Merging into Tunnel';
        this.metrics.downloadMbps = 47.3;
        this.metrics.uploadMbps = 8.5;
        this.metrics.activeConnections = 57;
        this.metrics.packetsPerSec = 2410;
        break;
    }
  }

  private animateReconnection() {
    const steps = [
      'Resolving VPN server IP...',
      'Creating WireGuard interface (wg0)...',
      'Applying strict iptables kill switch rules...',
      'Configuring kernel routing table (0.0.0.0/0)...',
      'Initiating ChaCha20-Poly1305 handshake...',
      'Tunnel established! IP verified.',
    ];
    let stepIndex = 0;

    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        this.reconnectStep = steps[stepIndex];
        this.reconnectProgress = Math.round(((stepIndex + 1) / steps.length) * 100);
        stepIndex++;
        this.broadcast();
      } else {
        clearInterval(interval);
        this.state = 'connected';
        this.statusMessage = 'Tunnel reconnected successfully';
        this.metrics.downloadMbps = 42.6;
        this.metrics.uploadMbps = 8.4;
        this.metrics.latencyMs = 32;
        this.broadcast();
      }
    }, 600);
  }

  private tick() {
    if (!this.isSimulationActive) return;

    // Increment uptime & handshake timer
    if (this.state === 'connected' || this.state === 'degraded') {
      this.metrics.uptimeSeconds++;
      this.vpnSettings.handshakeAgoSeconds = (this.vpnSettings.handshakeAgoSeconds + 1) % 120;
    }

    // Dynamic micro-jitter for live feel
    if (this.state === 'connected' || this.state === 'degraded') {
      const jitter = (Math.random() - 0.5) * 2;
      let targetDown = this.metrics.downloadMbps;

      if (this.currentScenario === 'normal') {
        targetDown = 42.6 + Math.sin(Date.now() / 3000) * 8 + jitter;
      } else if (this.currentScenario === 'large_download') {
        targetDown = 85.0 + Math.sin(Date.now() / 2000) * 6 + jitter;
      } else if (this.currentScenario === 'multi_device') {
        targetDown = 47.3 + Math.sin(Date.now() / 4000) * 5 + jitter;
      }

      this.metrics.downloadMbps = Math.max(0.5, +targetDown.toFixed(1));
      this.metrics.uploadMbps = Math.max(0.2, +(targetDown * 0.18 + jitter * 0.2).toFixed(1));
      this.metrics.packetsPerSec = Math.round(this.metrics.downloadMbps * 43.5 + 40);

      // Append traffic data point
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.trafficHistory.push({
        timestamp: nowStr,
        download: this.metrics.downloadMbps,
        upload: this.metrics.uploadMbps,
      });
      if (this.trafficHistory.length > 60) {
        this.trafficHistory.shift();
      }

      // Update peak & average
      if (this.metrics.downloadMbps > this.metrics.peakMbps) {
        this.metrics.peakMbps = this.metrics.downloadMbps;
      }
      const sum = this.trafficHistory.reduce((acc, p) => acc + p.download, 0);
      this.metrics.averageMbps = +(sum / this.trafficHistory.length).toFixed(1);
    }

    this.broadcast();
  }

  public subscribe(callback: (state: any) => void) {
    this.subscribers.add(callback);
    callback(this.getSnapshot());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private broadcast() {
    const snap = this.getSnapshot();
    this.subscribers.forEach((cb) => cb(snap));
  }

  public getSnapshot() {
    return {
      state: this.state,
      statusMessage: this.statusMessage,
      reconnectStep: this.reconnectStep,
      reconnectProgress: this.reconnectProgress,
      settings: this.vpnSettings,
      metrics: this.metrics,
      trafficHistory: [...this.trafficHistory],
      appTraffic: [...this.appTraffic],
      destinations: [...this.destinations],
      connections: [...this.connections],
      firewallStats: { ...this.firewallStats },
      firewallEvents: [...this.firewallEvents],
      dnsMetrics: { ...this.dnsMetrics },
      routes: [...this.routes],
      securityEvents: [...this.securityEvents],
      devices: [...this.devices],
      systemHealth: { ...this.systemHealth },
      scenario: this.currentScenario,
    };
  }

  public triggerAction(action: 'disconnect' | 'reconnect' | 'change_server') {
    if (action === 'disconnect') {
      this.setScenario('tunnel_disconnect');
    } else if (action === 'reconnect') {
      this.setScenario('vpn_reconnect');
    } else if (action === 'change_server') {
      this.setScenario('server_change');
    }
  }

  public updateServer(serverName: string, country: string, ip: string) {
    this.vpnSettings.serverName = serverName;
    this.vpnSettings.serverCountry = country;
    this.vpnSettings.serverIP = ip;
    this.setScenario('server_change');
  }
}

export const simulationEngine = new SimulationEngine();
