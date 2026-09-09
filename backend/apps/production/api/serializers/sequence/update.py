from typing import Any

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Sequence


class SequenceUpdateSerializer(BaseWriteSerializer[Any]):
    class Meta:
        model = Sequence
        fields = (
            "name",
            "code",
            "status",
            "description",
            "frame_in",
            "frame_out",
            "department",
            "tags",
            "metadata",
        )
