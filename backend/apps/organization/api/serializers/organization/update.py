from typing import Any

from apps.core.api.serializers import BaseWriteSerializer
from apps.core.api.serializers.fields import CaseInsensitiveChoiceField
from apps.core.choices.lifecycle import LifecycleStatus
from apps.organization.models import Organization


class OrganizationUpdateSerializer(
    BaseWriteSerializer[Any],
):
    # Frontend contract sends Title Case (`Archived`/`Active`); DB stores lowercase.
    status = CaseInsensitiveChoiceField(
        choices=LifecycleStatus.choices, required=False
    )


    class Meta:
        model = Organization

        read_only_fields = (
            "id",
            "code",
            "slug",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )

        fields = "__all__"
