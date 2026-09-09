from typing import Any

from apps.core.api.serializers import BaseNestedSerializer
from apps.organization.models import Organization


class OrganizationNestedSerializer(
    BaseNestedSerializer[Any],
):

    class Meta:
        model = Organization

        fields = (
            "id",
            "uuid",
            "name",
        )
