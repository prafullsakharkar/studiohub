"""
Permission Service.
"""

from apps.identity.models import Permission


class PermissionService:
    """
    Permission business logic.
    """

    @staticmethod
    def create(**data):
        return Permission.objects.create_permission(**data)

    @staticmethod
    def update(permission, **data):
        for field, value in data.items():
            setattr(permission, field, value)

        permission.full_clean()
        permission.save()

        return permission

    @staticmethod
    def activate(permission):
        permission.is_active = True
        permission.save(update_fields=["is_active"])
        return permission

    @staticmethod
    def deactivate(permission):
        permission.is_active = False
        permission.save(update_fields=["is_active"])
        return permission
