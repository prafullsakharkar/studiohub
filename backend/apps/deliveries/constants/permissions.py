"""
Deliveries permissions — module:action codes matching frontend RBAC (e.g., 'deliveries:read').

These are distinct from Organization RBAC (organization.*) and map to frontend's
`types/auth.ts` Permission union. They are checked via HasPermission with
organization context, but the permission codes are deliveries-specific.

``APPROVE`` signs a delivery off (and reopens or cancels a signed-off one), ``SEND`` sends it and
records the client's answer, ``VIEW_SECRET`` reads the passcode. ``STATUS_OVERRIDE`` and
``SOD_OVERRIDE`` are audited corrections granted to no role: they are checked explicitly, so a
superuser does not hold them by being a superuser (docs/deliveries/CONTRACTS.md section 4).
"""


class DeliveryPermissions:
    VIEW = "delivery.view"
    CREATE = "delivery.create"
    UPDATE = "delivery.update"
    DELETE = "delivery.delete"
    APPROVE = "delivery.approve"
    SEND = "delivery.send"
    VIEW_SECRET = "delivery.view_secret"
    STATUS_OVERRIDE = "delivery.status.override"
    SOD_OVERRIDE = "delivery.sod.override"
