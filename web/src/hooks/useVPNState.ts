import { useState, useEffect } from 'react';
import { simulationEngine } from '../services/simulationEngine';
import { ScenarioID, TunnelState, VPNSettings, TunnelMetrics } from '../types/vpn';
import { LiveSnapshot } from '../types';

export function useVPNState(liveSnapshot?: LiveSnapshot) {
  const [simState, setSimState] = useState(() => simulationEngine.getSnapshot());
  const [useLiveEngine, setUseLiveEngine] = useState(false);

  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((snapshot) => {
      setSimState(snapshot);
    });
    return () => unsubscribe();
  }, []);

  // If live engine is online and user requested live mode, blend live Gluetun data
  const effectiveState: TunnelState = useLiveEngine && liveSnapshot?.engine_online
    ? (liveSnapshot.state as TunnelState)
    : simState.state;

  const effectiveSettings: VPNSettings = useLiveEngine && liveSnapshot?.engine_online
    ? {
        ...simState.settings,
        protocol: (liveSnapshot.protocol as any) || 'openvpn',
        interfaceName: liveSnapshot.tunnel_interface || 'tun0',
        publicIP: liveSnapshot.public_ip?.public_ip || simState.settings.publicIP,
        serverCountry: liveSnapshot.country || simState.settings.serverCountry,
        serverCity: liveSnapshot.city || simState.settings.serverCity,
        serverName: `${liveSnapshot.country || 'Proton'} Live Node`,
        portForwarded: liveSnapshot.port_forwarding?.port || simState.settings.portForwarded,
        internalPort: liveSnapshot.port_forwarding?.internal_port || 8080,
      }
    : simState.settings;

  const effectiveMetrics: TunnelMetrics = useLiveEngine && liveSnapshot?.engine_online
    ? {
        ...simState.metrics,
        uptimeSeconds: liveSnapshot.uptime_seconds || simState.metrics.uptimeSeconds,
        latencyMs: 32,
      }
    : simState.metrics;

  const setScenario = (scenario: ScenarioID) => {
    setUseLiveEngine(false);
    simulationEngine.setScenario(scenario);
  };

  const triggerAction = (action: 'disconnect' | 'reconnect' | 'change_server') => {
    simulationEngine.triggerAction(action);
  };

  const updateServer = (serverName: string, country: string, ip: string) => {
    simulationEngine.updateServer(serverName, country, ip);
  };

  return {
    state: effectiveState,
    statusMessage: simState.statusMessage,
    reconnectStep: simState.reconnectStep,
    reconnectProgress: simState.reconnectProgress,
    settings: effectiveSettings,
    metrics: effectiveMetrics,
    trafficHistory: simState.trafficHistory,
    appTraffic: simState.appTraffic,
    destinations: simState.destinations,
    connections: simState.connections,
    firewallStats: simState.firewallStats,
    firewallEvents: simState.firewallEvents,
    dnsMetrics: simState.dnsMetrics,
    routes: simState.routes,
    securityEvents: simState.securityEvents,
    devices: simState.devices,
    systemHealth: simState.systemHealth,
    currentScenario: simState.scenario,
    useLiveEngine,
    setUseLiveEngine,
    setScenario,
    triggerAction,
    updateServer,
  };
}
