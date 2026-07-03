from .base import OrganizationSettingsBaseSerializer


class OrganizationSettingsNestedSerializer(OrganizationSettingsBaseSerializer):
    """
    Lightweight nested representation.
    """

    class Meta(OrganizationSettingsBaseSerializer.Meta):
        fields = (
            "uuid",
            "code",
            "name",
            "lead",
        )
