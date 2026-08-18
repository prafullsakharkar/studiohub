from apps.organization.validators.base import OrganizationBaseValidator


class GroupMemberValidator(OrganizationBaseValidator):
    """
    Validator for GroupMember model.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        """
        Validate GroupMember creation data.
        """
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        """
        Validate GroupMember update data.
        """
        return

    @classmethod
    def validate_delete(cls, instance):
        """
        Validate GroupMember deletion.
        """
        return
