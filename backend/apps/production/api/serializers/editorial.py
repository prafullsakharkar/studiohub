from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import EditorialCut


class EditorialCutSerializer(BaseReadSerializer[Any]):
    """Frontend EditorialCut shape (read-only; seeded/managed server-side)."""

    project_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()

    class Meta:
        model = EditorialCut
        fields = (
            "id",
            "project_id",
            "project_code",
            "sequence_code",
            "name",
            "code",
            "cut_type",
            "version",
            "fps",
            "duration_frames",
            "duration_tc",
            "start_tc",
            "end_tc",
            "source_edl_filename",
            "xml_manifest_url",
            "total_shots_in_cut",
            "matched_vfx_shots",
            "unmatched_shots",
            "editorial_notes",
            "editor_name",
            "conformed_by",
            "status",
            "burn_in_lut",
            "thumbnail_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""
