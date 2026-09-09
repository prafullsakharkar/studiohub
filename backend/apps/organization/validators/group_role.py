from apps.organization.validators.base import OrganizationBaseValidator


class GroupRoleValidator(OrganizationBaseValidator):
    """
    Validator for GroupRole model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate GroupRole creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate GroupRole update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate GroupRole deletion.
        """
        return
