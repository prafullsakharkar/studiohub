from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.production.models import StatusHistory


class StatusHistorySerializer(serializers.ModelSerializer[StatusHistory]):
    actor_id = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = StatusHistory
        fields = (
            "id",
            "entity_type",
            "entity_id",
            "entity_code",
            "from_status",
            "to_status",
            "reason",
            "actor_id",
            "actor_name",
            "changed_at",
        )
        read_only_fields = fields

    def get_actor_id(self, obj: StatusHistory) -> str | None:
        return str(obj.actor.pk) if obj.actor else None

    def get_actor_name(self, obj: StatusHistory) -> str:
        actor: Any = obj.actor
        if actor is None:
            return ""
        profile = getattr(actor, "profile", None)
        return (getattr(profile, "display_name", "") if profile else "") or getattr(
            actor, "email", ""
        )
