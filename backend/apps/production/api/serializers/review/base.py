from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.api.serializers.review import parts
from apps.production.models import Review
from apps.production.selectors.base import ProductionBaseSelector


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

    def _for_client(self, obj) -> bool:
        """
        Whether the reader is a client member of the review's project (C-RP-29). Without a request
        nobody can be told apart, so only client-visible comments are served (fail closed).
        """
        request = self.context.get("request")
        if request is None:
            return True
        return ProductionBaseSelector.is_client_on(request, obj.project_id)

    def get_comments(self, obj):
        client = self._for_client(obj)
        return [
            parts.comment_dict(c, client=client)
            for c in obj.comment_rows.all()
            if c.parent_id is None and (c.is_client_visible or not client)
        ]

    def get_notes(self, obj):
        return [parts.note_dict(n) for n in obj.note_rows.all()]

    def get_annotations(self, obj):
        return [parts.annotation_dict(a) for a in obj.annotation_rows.all()]

    def get_activity(self, obj):
        return [parts.activity_dict(a) for a in obj.activity_rows.all()]
