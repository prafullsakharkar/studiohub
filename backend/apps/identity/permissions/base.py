from rest_framework.permissions import BasePermission


class IdentityPermission(
    BasePermission,
):
    """
    Base permission class.
    """

    permission_required = None
    role_required = None
