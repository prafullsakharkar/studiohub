
from typing import Any

from django.db import models

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.core.api.serializers.fields import CaseInsensitiveChoiceField
from apps.core.choices.lifecycle import LifecycleStatus
from apps.organization.models import Department, Office, Person, Team

from .create import resolve_person_role, resolve_person_user


class PersonUpdateSerializer(BaseWriteSerializer[Any]):
    # Contract aliases → model relations / columns. All previously delivered
    # org-structure fields are writable here; silent drops were the bug.
    role_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        write_only=True,
        source="role",
    )
    full_name = serializers.CharField(
        required=False, allow_blank=False, source="name"
    )
    department_id = serializers.UUIDField(required=False, allow_null=True)
    team_id = serializers.UUIDField(required=False, allow_null=True)
    office_id = serializers.UUIDField(required=False, allow_null=True)
    # Linked auth identity (N1); resolved in validate, fail closed.
    user_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    # Frontend contract sends Title Case ("Active"); DB stores lowercase.
    status = CaseInsensitiveChoiceField(
        choices=LifecycleStatus.choices, required=False
    )

    def validate(self, attrs):
        if "user_id" in attrs:
            # See create.py: ``user`` is reserved for the acting user.
            attrs["linked_user"] = resolve_person_user(attrs.pop("user_id"))
        role_ref = attrs.get("role")
        if role_ref:
            organization = getattr(self.instance, "organization", None)
            attrs["role"] = resolve_person_role(role_ref, organization)
        elif "role" in attrs and attrs.get("role") is None:
            attrs["role"] = None

        region = getattr(self.instance, "organization", None)
        for key, model, relation in (
            ("department_id", Department, "department"),
            ("team_id", Team, "team"),
            ("office_id", Office, "office"),
        ):
            if key not in attrs:
                continue
            ref = attrs.pop(key)
            if ref is None:
                attrs[relation] = None
                continue
            qs = model.objects.filter(id=ref, is_deleted=False)
            if region is not None:
                if model.__name__ == "Person":
                    # Person.organization is nullable for legacy rows (model
                    # contract): accept org members and unscoped legacy rows.
                    qs = qs.filter(
                        models.Q(organization_id=region.id)
                        | models.Q(organization__isnull=True)
                    )
                else:
                    qs = qs.filter(organization_id=region.id)
            target = qs.first()
            if target is None:
                raise serializers.ValidationError({key: "Unknown record."})
            attrs[relation] = target
        return attrs

    class Meta:
        model = Person
        fields = (
            "name",
            "full_name",
            "email",
            "phone",
            "date_of_birth",
            "nationality",
            "description",
            "status",
            "role_id",
            "user_id",
            "department_id",
            "team_id",
            "office_id",
            "seniority",
            "skills",
            "timezone",
            "security_clearance",
            "availability_status",
        )
