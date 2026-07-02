from .summary import OrganizationSummarySerializer


class OrganizationListSerializer(
    OrganizationSummarySerializer,
):
    """
    Dedicated list serializer.

    Reserved for future list-only fields.
    """

    pass
