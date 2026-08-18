from apps.organization.validators.base import OrganizationBaseValidator


class GroupValidator(OrganizationBaseValidator):
    """
    Validator for Group model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate Group creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate Group update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate Group deletion.
        """
        return
