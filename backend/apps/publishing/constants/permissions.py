"""
Publishing permission codes, checked with ``HasPermission`` (identity RBAC).

``DEPRECATE`` and ``REVOKE`` move a registered file between its lifecycle states,
``STORAGE_MANAGE`` administers storage roots (studio-wide), and ``STATUS_OVERRIDE`` is the audited correction that
leaves a guarded state: granted to no seeded role, not implied by superuser, and a scoped
credential must list it (delivery-pipeline X-07).
"""


class PublishPermissions:
    VIEW = "publishing.view"
    CREATE = "publishing.create"
    UPDATE = "publishing.update"
    DELETE = "publishing.delete"
    DEPRECATE = "publishing.deprecate"
    REVOKE = "publishing.revoke"
    STORAGE_MANAGE = "publishing.storage.manage"
    STATUS_OVERRIDE = "publishing.status.override"
