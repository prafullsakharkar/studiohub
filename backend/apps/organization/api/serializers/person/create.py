
from typing import Any

from django.db import models
from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.organization.models import Department, Office, Person, Position, Team


def resolve_person_user(user_ref):
    """Resolve a ``user_id`` against the auth user table.

    Users are global identities (no org scoping on the User row itself);
    unknown ids are rejected — fail closed. ``None`` clears the link.
    """
    from django.contrib.auth import get_user_model

    if user_ref is None:
        return None
    target = get_user_model().objects.filter(id=user_ref).first()
    if target is None:
        raise serializers.ValidationError({"user_id": "Unknown user."})
    return target


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

    # Flat relation ids accepted by the person forms; resolved in validate.
    department_id = serializers.UUIDField(required=False, allow_null=True)
    team_id = serializers.UUIDField(required=False, allow_null=True)
    office_id = serializers.UUIDField(required=False, allow_null=True)

    # Linked auth identity (N1); resolved in validate, fail closed.
    user_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    def to_internal_value(self, data):
        # Frontend contract posts `full_name`; the model uses `name`.
        if isinstance(data, dict):
            data = dict(data)
            if "name" not in data and isinstance(data.get("full_name"), str):
                data["name"] = data["full_name"]
        return super().to_internal_value(data)

    def validate(self, attrs):
        if "user_id" in attrs:
            # NOTE: mapped to ``linked_user``, not ``user`` — BusinessService
            # reserves the ``user`` kwarg for the acting user; PersonService
            # translates it onto the model FK (see PersonService).
            attrs["linked_user"] = resolve_person_user(attrs.pop("user_id"))
        role_ref = attrs.get("role")
        if role_ref:
            organization = attrs.get("organization")
            if organization is None:
                request = self.context.get("request")
                organization = getattr(request, "organization", None)
            attrs["role"] = resolve_person_role(role_ref, organization)
        elif role_ref is None and "role" in attrs and attrs["role"] is None:
            attrs.pop("role")

        region = attrs.get("organization")
        if region is None:
            request = self.context.get("request")
            region = getattr(request, "organization", None)
        for key, model, relation in (
            ("department_id", Department, "department"),
            ("team_id", Team, "team"),
            ("office_id", Office, "office"),
        ):
            if key not in attrs:
                continue
            ref = attrs.pop(key)
            if ref is None:
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
            "id",
            "uuid",
            "name",
            "email",
            "phone",
            "date_of_birth",
            "nationality",
            "description",
            "organization",
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
        read_only_fields = ("id", "uuid")
