
from rest_framework import serializers

from apps.organization.services.position import (
    PositionService,
)

from .base import PositionBaseSerializer


class PositionCreateSerializer(
    PositionBaseSerializer,
):

    def to_internal_value(self, data):
        # Frontend contract aliases: the Positions UI posts `title` and
        # `organization_id`; the model uses `name` and `organization`.
        # The URL/header organization always wins over the payload (tenant
        # boundary); a payload org that is unknown or mismatched fails closed.
        if isinstance(data, dict):
            data = dict(data)
            if "name" not in data and isinstance(data.get("title"), str):
                data["name"] = data["title"]
            if "organization" not in data:
                org_ref = data.get("organization_id")
                request = self.context.get("request") if isinstance(self.context, dict) else None
                context_org = getattr(request, "organization", None)
                if isinstance(org_ref, str) and org_ref:
                    from apps.organization.selectors.organization import OrganizationSelector

                    org = OrganizationSelector.resolve_by_lookup(org_ref)
                    if org is None:
                        raise serializers.ValidationError(
                            {"organization_id": "Unknown organization."}
                        )
                    if context_org is not None and str(org.id) != str(context_org.id):
                        raise serializers.ValidationError(
                            {"organization_id": "Organization mismatch."}
                        )
                    data["organization"] = str(org.id)
                elif context_org is not None:
                    data["organization"] = str(context_org.id)
        return super().to_internal_value(data)

    def create(self, validated_data):
        return PositionService.create(
            **validated_data,
        )
