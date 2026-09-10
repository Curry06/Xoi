# Open Questions

| Question | Confidence | Needed verification |
| --- | --- | --- |
| Does live Proton forwarding reach Caddy from the public internet for this operator? | UNKNOWN | Real account, DNS, and external request test. |
| Which dashboard panels should become engine telemetry? | UNKNOWN | Product decision and engine API/metrics design. |
| What public TLS strategy is desired? | UNKNOWN | Decide DNS-01, supplied certificates, or no public TLS. |
| Is bridge-only native API isolation sufficient for all deployed workloads? | INFERRED | Review actual Docker network membership and host firewall. |
