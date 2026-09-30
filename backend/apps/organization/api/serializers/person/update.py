
from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.organization.models import Person

from .create import resolve_person_role


class PersonUpdateSerializer(BaseWriteSerializer[Any]):
    role_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        write_only=True,
        source="role",
    )

    def validate(self, attrs):
        role_ref = attrs.get("role")
        if role_ref:
            organization = getattr(self.instance, "organization", None)
            attrs["role"] = resolve_person_role(role_ref, organization)
        elif "role" in attrs and attrs.get("role") is None:
            attrs["role"] = None
        return attrs

    class Meta:
        model = Person
        fields = ("name", "email", "phone", "date_of_birth", "nationality", "description", "role_id")
