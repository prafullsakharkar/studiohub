from apps.organization.validators.base import OrganizationBaseValidator


class PersonalAccessTokenValidator(OrganizationBaseValidator):
    """
    Validator for PersonalAccessToken model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate PersonalAccessToken creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate PersonalAccessToken update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate PersonalAccessToken deletion.
        """
        return
