# Observability Baseline
## Logging standard
- Format: JSON log lines
- Required fields:
  - `timestamp`
  - `level`
  - `context`
  - `message`
  - `trace` (optional for errors)

## Metrics baseline
- Endpoint: `/api/metrics`
- Current baseline metrics:
  - process uptime seconds
  - resident memory bytes
  - heap used bytes
  - process start timestamp

## Redaction policy
Never emit secrets or high-risk personal data in logs:
- Passwords, tokens, API keys
- Full session identifiers
- Raw payment or legal identifiers

## Dashboards
Use:
- `infra/compose/docker-compose.observability.yml`
- `infra/compose/prometheus.yml`

Grafana and Prometheus are seeded for local inspection and can be expanded as domain metrics are added.
