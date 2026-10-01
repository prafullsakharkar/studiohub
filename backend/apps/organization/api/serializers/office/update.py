
from django.db import models
from rest_framework import serializers

from apps.organization.models import Person
from apps.organization.services.office import (
    OfficeService,
)

from .base import OfficeBaseSerializer


class OfficeUpdateSerializer(
    OfficeBaseSerializer,
):
    # Flat alias the edit form writes; maps onto the ``manager`` relation.
    manager_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta(OfficeBaseSerializer.Meta):
        fields = (
            *OfficeBaseSerializer.Meta.fields,
            "working_hours",
            "headcount",
            "workstations_count",
            "render_nodes_count",
            "is_active",
            "manager_id",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "manager_id" in attrs:
            ref = attrs.pop("manager_id")
            if ref is None:
                attrs["manager"] = None
            else:
                region = getattr(self.instance, "organization", None)
                qs = Person.objects.filter(id=ref, is_deleted=False)
                if region is not None:
                    # Person.organization is nullable for legacy rows.
                    qs = qs.filter(
                        models.Q(organization_id=region.id)
                        | models.Q(organization__isnull=True)
                    )
                target = qs.first()
                if target is None:
                    raise serializers.ValidationError({"manager_id": "Unknown person."})
                attrs["manager"] = target
        return attrs

    def update(
        self,
        instance,
        validated_data,
    ):
        return OfficeService.update(
            instance,
            **validated_data,
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        mgr = getattr(instance, "manager", None)
        data["manager_id"] = str(instance.manager_id) if instance.manager_id else None
        data["manager_name"] = mgr.name if mgr else ""
        return data
