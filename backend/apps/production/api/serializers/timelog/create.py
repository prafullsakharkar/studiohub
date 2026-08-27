from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Timelog


class TimelogCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    person = serializers.PrimaryKeyRelatedField(
        queryset=Timelog._meta.get_field("person").remote_field.model.objects.all(),
        required=False,
        allow_null=True,
    )
    project = serializers.PrimaryKeyRelatedField(
        queryset=Timelog._meta.get_field("project").remote_field.model.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Timelog
        fields = (
            "id",
            "uuid",
            "task",
            "project",
            "person",
            "department",
            "duration_hours",
            "date",
            "billable",
            "notes",
            "status",
            "activity_category",
            "hourly_rate_usd",
        )
        read_only_fields = ("id", "uuid")
