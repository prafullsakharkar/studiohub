"""
Publishing permission codes, checked with ``HasPermission`` (identity RBAC).

``DEPRECATE`` and ``REVOKE`` move a registered file between its lifecycle states,
``STORAGE_MANAGE`` administers storage roots (studio-wide), ``TEMPLATE_MANAGE`` writes path
templates (studio-wide and per project, review-pipeline RP-4, Q-RP-23), and ``STATUS_OVERRIDE`` is the audited correction that
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
    TEMPLATE_MANAGE = "publishing.template.manage"
    STATUS_OVERRIDE = "publishing.status.override"
