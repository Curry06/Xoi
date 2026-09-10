export type ConnectionState =
  | 'unknown'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnecting'
  | 'degraded'
  | 'error';

export interface Capabilities {
  can_connect: boolean;
  can_disconnect: boolean;
  can_reconnect: boolean;
  can_switch_server_runtime: boolean;
  can_change_protocol_runtime: boolean;
  can_control_dns_runtime: boolean;
  can_read_port_forwarding: boolean;
  can_read_traffic: boolean;
  can_control_firewall: boolean;
  can_read_version: boolean;
  can_read_public_ip: boolean;
  can_read_updater_status: boolean;
  can_control_updater_runtime: boolean;
}

export interface PublicIP {
  public_ip?: string;
  region?: string;
  country?: string;
  city?: string;
  hostname?: string;
  organization?: string;
  timezone?: string;
}

export interface PortForwardingInfo {
  available: boolean;
  port: number;
  internal_port: number;
  public_ip: string;
  full_endpoint: string;
  last_allocated?: string;
  status: 'active' | 'unavailable' | 'pending';
}

export interface TrafficPoint {
  timestamp: string;
  download_rate: number; // bytes/sec
  upload_rate: number;   // bytes/sec
}

export interface TrafficMetrics {
  available: boolean;
  interface?: string;
  download_rate: number;
  upload_rate: number;
  total_download: number;
  total_upload: number;
  history_1m: TrafficPoint[];
  history_15m: TrafficPoint[];
  history_1h: TrafficPoint[];
}

export interface LiveSnapshot {
  state: ConnectionState;
  engine_online: boolean;
  engine_version: string;
  dashboard_version: string;
  is_mock: boolean;
  mock_scenario?: string;
  provider: string;
  protocol: string;
  country?: string;
  city?: string;
  hostname?: string;
  public_ip: PublicIP;
  tunnel_interface: string;
  uptime_seconds: number;
  connected_since?: string;
  reconnection_count: number;
  dns_status: string;
  updater_status: string;
  port_forwarding: PortForwardingInfo;
  traffic: TrafficMetrics;
  capabilities: Capabilities;
  operation_in_progress: boolean;
  last_updated: string;
}

export interface Server {
  vpn: string;
  country: string;
  region?: string;
  city?: string;
  hostname: string;
  server_name?: string;
  number?: number;
  tcp: boolean;
  udp: boolean;
  port_forward: boolean;
  secure_core: boolean;
  tor: boolean;
  stream: boolean;
  ips: string[];
}

export interface Profile {
  id: string;
  name: string;
  provider: string;
  country?: string;
  region?: string;
  city?: string;
  hostname?: string;
  protocol: 'wireguard' | 'openvpn_udp' | 'openvpn_tcp' | string;
  port_forwarding: boolean;
  block_malicious: boolean;
  block_ads: boolean;
  block_surveillance: boolean;
  is_favorite: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export type EventType =
  | 'connection_state'
  | 'ip_change'
  | 'port_change'
  | 'audit'
  | 'diagnostic'
  | 'health_check';

export interface HistoryEvent {
  id: string;
  timestamp: string;
  type: EventType;
  severity: 'info' | 'warn' | 'error';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface BootstrapResponse {
  authenticated: boolean;
  auth_required: boolean;
  username?: string;
  snapshot: LiveSnapshot;
  capabilities: Capabilities;
  is_mock: boolean;
  profiles_count: number;
  server_time: string;
}

export interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    request_id: string;
  };
}

export interface TelegramSettings {
  enabled: boolean;
  chat_id: string;
  token_set: boolean;
}

export interface TelegramSettingsUpdateRequest {
  enabled: boolean;
  bot_token?: string;
  chat_id: string;
}

export type RoutingType = 'domain' | 'path';
export type RouteStatus =
  | 'ACTIVE'
  | 'DISABLED'
  | 'UNHEALTHY'
  | 'CONFIG_ERROR'
  | 'TARGET_UNREACHABLE'
  | 'VPN_OFFLINE'
  | 'PUBLIC_ENDPOINT_UNAVAILABLE';

export interface ProxyRoute {
  id: string;
  name: string;
  routing_type: RoutingType;
  domain: string;
  path: string;
  protocol: string;
  target_host: string;
  target_port: number;
  enabled: boolean;
  websocket: boolean;
  tls: boolean;
  health_check: boolean;
  status: RouteStatus;
  response_time_ms: number;
  last_health_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PublicEndpoint {
  public_ip: string;
  forwarded_port: number;
  internal_port: number;
  protocol: string;
  status: string;
  updated_at: string;
}

export interface RouteMetrics {
  route_id: string;
  total_requests: number;
  active_connections: number;
  bytes_received: number;
  bytes_sent: number;
  average_latency_ms: number;
  error_count: number;
  last_sampled_at: string;
}

export interface ProxyStatus {
  engine_running: boolean;
  engine_type: string;
  routes_count: number;
  active_routes: number;
  public_endpoint: PublicEndpoint;
  last_reload_error?: string;
  last_reloaded_at: string;
}

export interface CreateRouteRequest {
  name: string;
  routing_type: RoutingType;
  domain?: string;
  path?: string;
  protocol: string;
  target_host: string;
  target_port: number;
  enabled?: boolean;
  websocket?: boolean;
  tls?: boolean;
  health_check?: boolean;
}

export interface TargetProbeResult {
  reachable: boolean;
  latency_ms: number;
  status_code: number;
  error?: string;
}
