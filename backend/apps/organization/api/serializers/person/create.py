
from typing import Any

from django.db import models
from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.organization.models import Person, Position


def resolve_person_role(role_ref, organization):
    """Resolve a ``role_id`` against the org-scoped position catalog.

    Valid roles are the organization's own custom positions and the
    organization-agnostic global masters. Anything else (unknown id,
    sibling-org custom) is rejected — fail closed.
    """
    scoped = models.Q(
        scope=Position.Scope.GLOBAL_MASTER,
        organization__isnull=True,
    )
    if organization is not None:
        scoped |= models.Q(
            scope=Position.Scope.ORGANIZATION_CUSTOM,
            organization=organization,
        )
    position = Position.objects.filter(id=role_ref).filter(scoped).first()
    if position is None:
        raise serializers.ValidationError(
            {"role_id": "Unknown or out-of-scope role for this organization."}
        )
    return position


class PersonCreateSerializer(BaseWriteSerializer[Any]):
    role_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        write_only=True,
        source="role",
    )

    def to_internal_value(self, data):
        # Frontend contract posts `full_name`; the model uses `name`.
        if isinstance(data, dict):
            data = dict(data)
            if "name" not in data and isinstance(data.get("full_name"), str):
                data["name"] = data["full_name"]
        return super().to_internal_value(data)

    def validate(self, attrs):
        role_ref = attrs.get("role")
        if role_ref:
            organization = attrs.get("organization")
            if organization is None:
                request = self.context.get("request")
                organization = getattr(request, "organization", None)
            attrs["role"] = resolve_person_role(role_ref, organization)
        elif role_ref is None and "role" in attrs and attrs["role"] is None:
            attrs.pop("role")
        return attrs

    class Meta:
        model = Person
        fields = ("name", "email", "phone", "date_of_birth", "nationality", "description", "organization", "role_id")
