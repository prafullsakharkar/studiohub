from apps.organization.validators.base import OrganizationBaseValidator


class UserRoleValidator(OrganizationBaseValidator):
    """
    Validator for UserRole model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate UserRole creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate UserRole update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate UserRole deletion.
        """
        return
