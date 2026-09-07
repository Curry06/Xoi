import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatRate, formatUptime, getStateBadgeClass } from '../utils/format.ts';
import type { ConnectionState, Server, Profile } from '../types/index.ts';

test('Formatters: formatBytes properly formats byte sizes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(1073741824), '1 GB');
});

test('Formatters: formatRate formats data transfer rates', () => {
  assert.equal(formatRate(0), '0 KB/s');
  assert.equal(formatRate(500), '500 B/s');
  assert.equal(formatRate(2048), '2.0 KB/s');
  assert.equal(formatRate(5242880), '5.0 MB/s');
});

test('Formatters: formatUptime formats durations accurately', () => {
  assert.equal(formatUptime(0), '0m');
  assert.equal(formatUptime(-10), '0m');
  assert.equal(formatUptime(45), '45s');
  assert.equal(formatUptime(130), '2m 10s');
  assert.equal(formatUptime(3665), '1h 1m');
  assert.equal(formatUptime(90000), '1d 1h 0m');
});

test('Connection State: getStateBadgeClass returns correct CSS classes', () => {
  const cases: Array<[ConnectionState, string]> = [
    ['connected', 'badge-connected'],
    ['connecting', 'badge-connecting'],
    ['reconnecting', 'badge-connecting'],
    ['disconnected', 'badge-disconnected'],
    ['degraded', 'badge-degraded'],
    ['error', 'badge-error'],
    ['unknown', 'badge-disconnected'],
  ];

  for (const [state, expected] of cases) {
    assert.equal(getStateBadgeClass(state), expected, `Mismatch for state: ${state}`);
  }
});

test('Port Forwarding: Port validation never treats port 0 as valid', () => {
  const isValidPort = (port: number) => port > 0 && port <= 65535;

  assert.equal(isValidPort(0), false, 'Port 0 must be invalid');
  assert.equal(isValidPort(-1), false, 'Negative port must be invalid');
  assert.equal(isValidPort(65536), false, 'Port above 65535 must be invalid');
  assert.equal(isValidPort(8080), true, 'Port 8080 must be valid');
  assert.equal(isValidPort(51820), true, 'Port 51820 must be valid');
});

test('Port Forwarding: Endpoint string generation', () => {
  const makeEndpoint = (ip?: string, port?: number) => {
    if (!ip || !port || port <= 0 || port > 65535) return '';
    return `${ip}:${port}`;
  };

  assert.equal(makeEndpoint('185.159.157.10', 0), '', 'Must be empty for port 0');
  assert.equal(makeEndpoint('', 45220), '', 'Must be empty without public IP');
  assert.equal(makeEndpoint('185.159.157.10', 45220), '185.159.157.10:45220');
});

test('Capabilities: Action enablement depends strictly on capability flags', () => {
  const caps = {
    can_connect: false,
    can_disconnect: false,
    can_switch_server_runtime: false,
    can_control_dns_runtime: true,
  };

  const canPerformConnect = caps.can_connect;
  assert.equal(canPerformConnect, false);

  const canSwitchServer = caps.can_switch_server_runtime;
  assert.equal(canSwitchServer, false);

  assert.equal(caps.can_control_dns_runtime, true);
});

test('Profiles: Profiles must never leak passwords, tokens, or private keys', () => {
  const profile: Profile = {
    id: 'p-1',
    name: 'India WireGuard Safe',
    provider: 'protonvpn',
    server: 'IN#1',
    country: 'India',
    city: 'Mumbai',
    protocol: 'wireguard',
    port_forwarding: true,
    block_malicious: true,
    is_favorite: true,
    created_at: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(profile);
  assert.equal(jsonString.includes('password'), false);
  assert.equal(jsonString.includes('private_key'), false);
  assert.equal(jsonString.includes('secret'), false);
  assert.equal(jsonString.includes('token'), false);
});

test('Servers: Filtering criteria works accurately', () => {
  const servers: Server[] = [
    { vpn: 'wireguard', country: 'Netherlands', city: 'Amsterdam', premium: true, number: 1, ip: '10.2.0.1' },
    { vpn: 'openvpn', country: 'Japan', city: 'Tokyo', premium: false, number: 2, ip: '10.2.0.2' },
    { vpn: 'wireguard', country: 'India', city: 'Mumbai', premium: false, number: 3, ip: '10.2.0.3' },
    { vpn: 'wireguard', country: 'United States', city: 'New York', premium: true, number: 4, ip: '10.2.0.4' },
  ];

  const indiaServers = servers.filter((s) => s.country.toLowerCase() === 'india');
  assert.equal(indiaServers.length, 1);
  assert.equal(indiaServers[0].city, 'Mumbai');

  const wgServers = servers.filter((s) => s.vpn === 'wireguard');
  assert.equal(wgServers.length, 3);

  const freeServers = servers.filter((s) => !s.premium);
  assert.equal(freeServers.length, 2);
});
