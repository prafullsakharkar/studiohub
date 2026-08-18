from apps.organization.validators.base import OrganizationBaseValidator


class PermissionValidator(OrganizationBaseValidator):
    """
    Validator for Permission model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate Permission creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate Permission update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate Permission deletion.
        """
        return
