from apps.core.api.serializers import BaseWriteSerializer
from apps.organization.models import Organization


class OrganizationUpdateSerializer(
    BaseWriteSerializer,
):

    class Meta:
        model = Organization

        read_only_fields = (
            "id",
            "uuid",
            "code",
            "slug",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )

        fields = "__all__"
