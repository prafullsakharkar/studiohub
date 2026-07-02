from apps.core.api.serializers import BaseNestedSerializer
from apps.organization.models import Organization


class OrganizationNestedSerializer(
    BaseNestedSerializer,
):

    class Meta:
        model = Organization

        fields = (
            "id",
            "uuid",
            "name",
        )
