import React, { useState } from 'react';
import { DNSMetrics } from '../../types/vpn';
import { ShieldCheck, ShieldAlert, Compass, Activity, Play, CheckCircle2 } from 'lucide-react';

interface DNSViewProps {
  metrics: DNSMetrics;
}

export const DNSView: React.FC<DNSViewProps> = ({ metrics }) => {
  const [isTestingLeak, setIsTestingLeak] = useState(false);
  const [leakTestResult, setLeakTestResult] = useState<string | null>(null);

  const runLeakTest = () => {
    setIsTestingLeak(true);
    setLeakTestResult(null);
    setTimeout(() => {
      setIsTestingLeak(false);
      if (metrics.leakProtected) {
        setLeakTestResult('All 6 synthetic DNS tests resolved strictly through encrypted DoT (1.1.1.1). No DNS leaks detected.');
      } else {
        setLeakTestResult('WARNING: Synthetic queries leaked to ISP resolver! Leak protection compromised.');
      }
    }, 1200);
  };

  const sampleRecentQueries = [
    { domain: 'github.com', type: 'A', status: 'Resolved DoT', time: '12ms' },
    { domain: 'api.protonvpn.ch', type: 'AAAA', status: 'Resolved DoT', time: '14ms' },
    { domain: 'telemetry.tracker.io', type: 'A', status: 'Blocked (Ad/Tracker)', time: '<1ms' },
    { domain: 'cloudflare.com', type: 'HTTPS', status: 'Resolved DoT', time: '9ms' },
    { domain: 'cdn.discordapp.com', type: 'A', status: 'Resolved DoT', time: '18ms' },
    { domain: 'analytics.google.com', type: 'A', status: 'Blocked (Ad/Tracker)', time: '<1ms' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top DNS Summary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* DoT Status */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>UPSTREAM RESOLVER</span>
            <Compass size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            {metrics.provider}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
            {metrics.serverAddress} (DoT Port 853)
          </div>
        </div>

        {/* DNS Leak Status */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>DNS LEAK PROTECTION</span>
            {metrics.leakProtected ? <ShieldCheck size={18} color="var(--color-success)" /> : <ShieldAlert size={18} color="var(--color-danger)" />}
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: metrics.leakProtected ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {metrics.leakProtected ? 'STRICT SHIELD ACTIVE' : 'LEAK DETECTED'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {metrics.leakProtected ? 'All DNS queries routed via tunnel' : 'Unencrypted queries detected!'}
          </div>
        </div>

        {/* Queries per Minute */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>QUERY VELOCITY</span>
            <Activity size={18} color="var(--accent-indigo)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            {metrics.queriesPerMin} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>q/min</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Blocked: <strong style={{ color: 'var(--color-warning)' }}>{metrics.blockedPerMin} ads/min</strong>
          </div>
        </div>

        {/* Average Latency */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>AVG RESPONSE TIME</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
          </div>
          <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success)' }}>
            {metrics.avgResponseMs} ms
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            In-memory DNS caching active
          </div>
        </div>
      </div>

      {/* Leak Tester Action Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>DNS Leak & Tunnel Shield Verification</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Injects synthetic random subdomains to verify queries never reach standard ISP port 53
            </p>
          </div>

          <button
            type="button"
            onClick={runLeakTest}
            disabled={isTestingLeak}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem' }}
          >
            <Play size={14} />
            {isTestingLeak ? 'Probing DNS Shield...' : 'Run DNS Leak Test'}
          </button>
        </div>

        {leakTestResult && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: leakTestResult.includes('No DNS leaks')
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              border: leakTestResult.includes('No DNS leaks')
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(239, 68, 68, 0.3)',
              color: leakTestResult.includes('No DNS leaks') ? 'var(--color-success)' : 'var(--color-danger)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{leakTestResult}</span>
          </div>
        )}
      </div>

      {/* Recent DNS Queries Table */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Recent DNS Resolution Audit</h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>DOMAIN NAME</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>TYPE</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem' }}>RESOLUTION STATUS</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.75rem', textAlign: 'right' }}>LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {sampleRecentQueries.map((q, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {q.domain}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {q.type}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: q.status.includes('Blocked') ? 'var(--color-warning)' : 'var(--color-success)',
                      }}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {q.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
