from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.api.serializers.review import parts
from apps.production.models import Review


class ReviewSerializer(BaseReadSerializer[Any]):
    """
    The lists (``versions``, ``reviewers``, ``comments``, ``notes``, ``annotations``, ``activity``) are
    rebuilt from their rows (D-30); the selector prefetches them. The JSON columns are not read.
    """

    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    lead_reviewer_name = serializers.CharField(read_only=True)
    versions = serializers.SerializerMethodField()
    reviewers = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    annotations = serializers.SerializerMethodField()
    activity = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("id","uuid","title","code","description","project_id","entity_type","entity_id","entity_code","status","supervisor_verdict","lead_reviewer_name","thumbnail_url","video_url","versions","reviewers","comments","notes","annotations","activity","client","vendor","created_at","updated_at")
        read_only_fields = ("id","uuid","created_at","updated_at")

    def get_versions(self, obj):
        return [parts.item_dict(i) for i in obj.items.all()]

    def get_reviewers(self, obj):
        return [parts.participant_dict(p) for p in obj.participants.all()]

    def get_comments(self, obj):
        return [parts.comment_dict(c) for c in obj.comment_rows.all() if c.parent_id is None]

    def get_notes(self, obj):
        return [parts.note_dict(n) for n in obj.note_rows.all()]

    def get_annotations(self, obj):
        return [parts.annotation_dict(a) for a in obj.annotation_rows.all()]

    def get_activity(self, obj):
        return [parts.activity_dict(a) for a in obj.activity_rows.all()]
