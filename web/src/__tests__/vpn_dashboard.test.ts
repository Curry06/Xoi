import { test, describe } from 'node:test';
import assert from 'node:assert';
import { simulationEngine } from '../services/simulationEngine.ts';

describe('VPN Management Dashboard Simulation Engine', () => {
  test('Initial state is nominal and protected', () => {
    simulationEngine.setScenario('normal');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.state, 'connected');
    assert.strictEqual(snap.scenario, 'normal');
    assert.strictEqual(snap.settings.killSwitchActive, true);
    assert.strictEqual(snap.dnsMetrics.leakProtected, true);
    assert.strictEqual(snap.settings.protocol, 'wireguard');
    assert.strictEqual(snap.settings.serverName, 'CH-Zurich-04');
    assert(snap.metrics.downloadMbps > 15, 'download rate should be healthy');
    assert(snap.metrics.latencyMs < 50, 'latency should be low in normal scenario');
  });

  test('Scenario: large_download produces high throughput', () => {
    simulationEngine.setScenario('large_download');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.scenario, 'large_download');
    assert(snap.metrics.downloadMbps >= 80, `Expected download >= 80 Mbps, got ${snap.metrics.downloadMbps}`);
    assert(snap.metrics.peakMbps >= snap.metrics.downloadMbps);
    assert(snap.metrics.packetsPerSec >= 5000);
  });

  test('Scenario: vpn_latency causes high RTT and degraded state', () => {
    simulationEngine.setScenario('vpn_latency');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.scenario, 'vpn_latency');
    assert.strictEqual(snap.state, 'degraded');
    assert(snap.metrics.latencyMs >= 120, `Expected latency >= 120ms, got ${snap.metrics.latencyMs}`);
    assert(snap.metrics.packetLossPercent > 0, 'Packet loss should be non-zero');
  });

  test('Scenario: tunnel_disconnect triggers kill-switch drop', () => {
    simulationEngine.setScenario('tunnel_disconnect');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.scenario, 'tunnel_disconnect');
    assert(snap.state === 'disconnected' || snap.state === 'blocked');
    assert.strictEqual(snap.metrics.downloadMbps, 0);
    assert.strictEqual(snap.metrics.uploadMbps, 0);
    assert.strictEqual(snap.settings.killSwitchActive, true);
    assert(snap.statusMessage.includes('Kill switch'), 'Status message should reflect kill switch activation');
  });

  test('Scenario: vpn_reconnect initiates 6-stage negotiation', () => {
    simulationEngine.setScenario('vpn_reconnect');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.scenario, 'vpn_reconnect');
    assert(snap.state === 'reconnecting' || snap.state === 'connecting');
    assert(snap.reconnectStep.length > 0);
    assert(snap.reconnectProgress >= 0 && snap.reconnectProgress <= 100);
  });

  test('Scenario: dns_leak alerts unencrypted leakage', () => {
    simulationEngine.setScenario('dns_leak');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.scenario, 'dns_leak');
    assert.strictEqual(snap.dnsMetrics.leakProtected, false);
    assert.strictEqual(snap.state, 'degraded');
  });

  test('Scenario: firewall_activity injects dropped packets', () => {
    simulationEngine.setScenario('firewall_activity');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.scenario, 'firewall_activity');
    assert(snap.firewallStats.droppedCount > 0);
    assert(snap.firewallEvents.some((e) => e.action === 'DROP'));
  });

  test('Scenario: server_change migrates to Singapore node', () => {
    simulationEngine.setScenario('server_change');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.scenario, 'server_change');
    assert.strictEqual(snap.settings.serverName, 'SG-Singapore-08');
    assert.strictEqual(snap.settings.serverCountry, 'Singapore');
  });

  test('Scenario: multi_device aggregates LAN client flows', () => {
    simulationEngine.setScenario('multi_device');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.scenario, 'multi_device');
    assert.strictEqual(snap.devices.length, 5);
    const sumDown = snap.devices.reduce((acc, d) => acc + d.downloadMbps, 0);
    assert(sumDown > 20, 'Aggregated LAN download should be significant');
  });

  test('Server switching manual action updates gateway', () => {
    simulationEngine.updateServer('SE-Stockholm-02', 'Sweden', '185.213.155.8');
    const snap = simulationEngine.getSnapshot();

    assert.strictEqual(snap.settings.serverName, 'SE-Stockholm-02');
    assert.strictEqual(snap.settings.serverCountry, 'Sweden');
    assert.strictEqual(snap.settings.serverIP, '185.213.155.8');
  });

  test('Subscriber listener receives updates', () => {
    let callCount = 0;
    const unsub = simulationEngine.subscribe(() => {
      callCount++;
    });

    simulationEngine.setScenario('normal');
    assert(callCount >= 1, 'Subscriber should be called on setScenario');
    unsub();
  });
});
