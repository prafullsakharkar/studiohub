from .base import OrganizationSerializer


class OrganizationDetailSerializer(
    OrganizationSerializer,
):

    class Meta(OrganizationSerializer.Meta):

        fields = "__all__"
