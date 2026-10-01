from typing import Any

from rest_framework import serializers

from apps.core.api.serializers import BaseWriteSerializer
from apps.core.api.serializers.fields import CaseInsensitiveChoiceField
from apps.core.choices.lifecycle import LifecycleStatus
from apps.organization.models import Office, Organization, Person


class OrganizationCreateSerializer(
    BaseWriteSerializer[Any],
):
    # Frontend contract sends Title Case (`Active`); DB stores lowercase.
    status = CaseInsensitiveChoiceField(
        choices=LifecycleStatus.choices, required=False
    )

    # Flat FK ids the frontend contract writes (HQ + supervisor selectors).
    # Mapped onto relations in validate().
    headquarters_office_id = serializers.UUIDField(
        required=False, allow_null=True
    )
    primary_contact_person_id = serializers.UUIDField(
        required=False, allow_null=True
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "headquarters_office_id" in attrs:
            office_id = attrs.pop("headquarters_office_id")
            if office_id is None:
                attrs["headquarters_office"] = None
            else:
                office = Office.objects.filter(
                    id=office_id, is_deleted=False
                ).first()
                if office is None:
                    raise serializers.ValidationError(
                        {"headquarters_office_id": "Unknown office."}
                    )
                attrs["headquarters_office"] = office
        if "primary_contact_person_id" in attrs:
            person_id = attrs.pop("primary_contact_person_id")
            if person_id is None:
                attrs["primary_supervisor"] = None
            else:
                person = Person.objects.filter(
                    id=person_id, is_deleted=False
                ).first()
                if person is None:
                    raise serializers.ValidationError(
                        {"primary_contact_person_id": "Unknown person."}
                    )
                attrs["primary_supervisor"] = person
        return attrs
    def to_representation(self, instance):
        # The writable alias above has no model attname behind it, so the
        # default renderer would drop it — surface the FK value explicitly.
        data = super().to_representation(instance)
        sup_id = getattr(instance, "primary_supervisor_id", None)
        data["primary_contact_person_id"] = str(sup_id) if sup_id else None
        return data


    class Meta:
        model = Organization

        # `id` is read-only: clients must not set it, but create responses
        # must include it (navigation, cache updates, follow-up calls).
        # `slug` stays excluded: the server derives it uniquely on save.
        exclude = (
            "slug",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_at",
        )

        read_only_fields = ("id",)
