from apps.organization.validators.base import OrganizationBaseValidator


class RoleValidator(OrganizationBaseValidator):
    """
    Validator for Role model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate Role creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate Role update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate Role deletion.
        """
        return
