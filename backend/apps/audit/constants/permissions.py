"""
Audit permission codes.

Reads stay open to authenticated users (org-scoped selectors; activity feeds
are product surface). State-changing operations require ``audit:update``.
"""


class AuditPermissions:
    VIEW = "audit:read"
    UPDATE = "audit:update"
