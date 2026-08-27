from rest_framework import serializers
from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Review
class ReviewSerializer(BaseReadSerializer):
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    lead_reviewer_name = serializers.CharField(read_only=True)
    class Meta:
        model = Review
        fields = ("id","uuid","title","code","description","project_id","entity_type","entity_id","entity_code","status","supervisor_verdict","lead_reviewer_name","thumbnail_url","video_url","versions","reviewers","comments","notes","annotations","activity","client","vendor","created_at","updated_at")
        read_only_fields = ("id","uuid","created_at","updated_at")
