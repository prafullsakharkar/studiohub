from typing import Any

from apps.core.api.serializers import BaseWriteSerializer
from apps.core.api.serializers.fields import CaseInsensitiveChoiceField
from apps.core.choices.lifecycle import LifecycleStatus
from apps.organization.models import Organization


class OrganizationCreateSerializer(
    BaseWriteSerializer[Any],
):
    # Frontend contract sends Title Case (`Active`); DB stores lowercase.
    status = CaseInsensitiveChoiceField(
        choices=LifecycleStatus.choices, required=False
    )

    class Meta:
        model = Organization

        exclude = (
            "id",
            "slug",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_at",
        )
