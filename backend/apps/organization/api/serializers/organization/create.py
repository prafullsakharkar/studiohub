from apps.core.api.serializers import BaseWriteSerializer
from apps.organization.models import Organization


class OrganizationCreateSerializer(
    BaseWriteSerializer,
):

    class Meta:
        model = Organization

        exclude = (
            "id",
            "uuid",
            "slug",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_at",
        )
