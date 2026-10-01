from typing import Any

from rest_framework import serializers

from apps.core.api.serializers import BaseWriteSerializer
from apps.organization.models import Department, Person


class DepartmentUpdateSerializer(
    BaseWriteSerializer[Any],
):
    # Flat alias the edit form writes; maps onto the ``manager`` relation.
    head_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "head_id" in attrs:
            ref = attrs.pop("head_id")
            if ref is None:
                attrs["manager"] = None
            else:
                region = getattr(self.instance, "organization", None)
                qs = Person.objects.filter(id=ref, is_deleted=False)
                if region is not None:
                    # Person.organization is nullable for legacy rows.
                    from django.db import models as dj_models

                    qs = qs.filter(
                        dj_models.Q(organization_id=region.id)
                        | dj_models.Q(organization__isnull=True)
                    )
                target = qs.first()
                if target is None:
                    raise serializers.ValidationError({"head_id": "Unknown person."})
                attrs["manager"] = target
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        mgr = getattr(instance, "manager", None)
        data["head_id"] = str(instance.manager_id) if instance.manager_id else None
        data["head_name"] = mgr.name if mgr else ""
        return data

    class Meta:
        model = Department

        read_only_fields = (
            "id",
            "uuid",
            "slug",
            "organization",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )

        fields = "__all__"
