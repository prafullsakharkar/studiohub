from apps.organization.validators.base import OrganizationBaseValidator


class APIKeyValidator(OrganizationBaseValidator):
    """
    Validator for APIKey model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate APIKey creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate APIKey update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate APIKey deletion.
        """
        return
