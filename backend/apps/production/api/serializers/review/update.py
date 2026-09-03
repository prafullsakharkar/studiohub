from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Review


class ReviewUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = Review
        fields = ("title","code","description","entity_type","entity_id","entity_code","status","supervisor_verdict","thumbnail_url","video_url")
