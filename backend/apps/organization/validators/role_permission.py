from apps.organization.validators.base import OrganizationBaseValidator


class RolePermissionValidator(OrganizationBaseValidator):
    """
    Validator for RolePermission model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate RolePermission creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate RolePermission update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate RolePermission deletion.
        """
        return
