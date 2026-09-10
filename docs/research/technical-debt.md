# Technical Debt

1. **No dashboard login page.** API login exists but React does not call it;
   authenticated deployments cannot use protected UI operations without an
   externally established session. **VERIFIED**.
2. **Simulated dashboard telemetry.** Several visual panels are not real engine
   telemetry; proxy metrics registry is not fed by Caddy logs/metrics.
   **VERIFIED**.
3. **Single-user, volatile auth.** No roles/OIDC/persistent sessions.
   **VERIFIED**.
4. **No public TLS automation.** Route TLS is rejected until DNS-01 or supplied
   certificates are designed. **VERIFIED**.
5. **Legacy material.** Native `v0` API remains for compatibility; older root
   architecture docs predate current Caddy wiring. **VERIFIED**.
