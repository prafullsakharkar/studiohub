from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Timelog


class TimelogUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = Timelog
        fields = (
            "department",
            "duration_hours",
            "date",
            "billable",
            "notes",
            "status",
            "activity_category",
            "hourly_rate_usd",
        )
