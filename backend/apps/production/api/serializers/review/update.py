from typing import Any

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import LockedFieldsMixin
from apps.production.models import Review


class ReviewUpdateSerializer(LockedFieldsMixin, BaseWriteSerializer[Any]):
    locked_fields = {"supervisor_verdict": "Use the verdict action."}

    class Meta:
        model = Review
        fields = ("title","code","description","entity_type","entity_id","entity_code","status","supervisor_verdict","thumbnail_url","video_url")
        read_only_fields = ("supervisor_verdict",)
