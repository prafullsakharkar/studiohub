# Audit

The audit trail is described where it is implemented:

- **Behaviour, visibility, retention, append-only rules:** [`docs/api/audit.md`](../api/audit.md).
- **Strategy:** [ADR-0011](../adr/ADR-0011-audit-logging-strategy.md).
- **Remediation notes (TM-011, TM-012):** [`tpn-immediate-remediation.md`](tpn-immediate-remediation.md).
- **Logging, as opposed to the audit trail:** [`audit-logging.md`](audit-logging.md).

In short: `audit_logs`, `change_logs` and `api_requests` cannot be changed after they are written (model
guard and database trigger); retention deletes expired rows on a schedule and is itself logged; readers
see only the projects they belong to unless they are platform administrators.
