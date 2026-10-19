"""
Audit permission codes.

Reads require ``audit.view`` (seeded to production-tier roles; audit rows are
platform-global). State-changing operations require ``audit:update``. The one
``()``-style open action left in the audit viewsets is ``track.create`` —
telemetry ingest from any authenticated client, not a read.
"""


class AuditPermissions:
    VIEW = "audit.view"
    UPDATE = "audit.update"
