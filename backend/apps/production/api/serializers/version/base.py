from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.api.serializers.review_media import ReviewMediaSerializer
from apps.production.constants.permissions import TaskPermissions
from apps.production.models import Version
from apps.production.permissions.checks import has_permission_code
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.selectors.task import TaskSelector


def readable_task(serializer: Any, obj: Version) -> Any:
    """
    RP-26 (C-RP-61, Q-RP-119): the version's task when the caller could open it (``task.view`` and
    the task list's own scoping), else ``None``. Worked out once per response: the page's task ids
    are checked together and the answers kept in the shared context. Without a request (internal
    use) the task is given.
    """
    task = obj.task if obj.task_id else None  # pyright: ignore[reportAttributeAccessIssue]
    if task is None:
        return None
    context = serializer.context
    request = context.get("request")
    if request is None:
        return task
    if "_can_view_tasks" not in context:
        context["_can_view_tasks"] = has_permission_code(request, TaskPermissions.VIEW)
    if not context["_can_view_tasks"]:
        return None
    readable: dict[Any, bool] = context.setdefault("_readable_tasks", {})
    if obj.task_id not in readable:  # pyright: ignore[reportAttributeAccessIssue]
        page = getattr(getattr(serializer, "parent", None), "instance", None)
        rows = list(page) if isinstance(page, (list, tuple)) else [obj]
        wanted = {getattr(row, "task_id", None) for row in rows} | {obj.task_id}  # pyright: ignore[reportAttributeAccessIssue]
        wanted = {task_id for task_id in wanted if task_id is not None and task_id not in readable}
        found = TaskSelector.readable_ids(request=request, task_ids=wanted)
        readable.update({task_id: task_id in found for task_id in wanted})
    return task if readable[obj.task_id] else None  # pyright: ignore[reportAttributeAccessIssue]


class VersionSerializer(BaseReadSerializer[Any]):
    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)
    published_by_id = serializers.UUIDField(read_only=True, allow_null=True)
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    project_code = serializers.SerializerMethodField()
    artist_id = serializers.UUIDField(read_only=True, allow_null=True)
    artist_name = serializers.SerializerMethodField()
    shot_id = serializers.UUIDField(read_only=True, allow_null=True)
    asset_id = serializers.UUIDField(read_only=True, allow_null=True)
    task_id = serializers.UUIDField(read_only=True, allow_null=True)
    # RP-26 (C-RP-61): the task's code and title, null when the caller could not open the task
    task_code = serializers.SerializerMethodField()
    task_title = serializers.SerializerMethodField()
    # The movie the server made (C-RP-21): the ready row, and the newest upload not ready yet.
    review_media = serializers.SerializerMethodField()
    review_media_job = serializers.SerializerMethodField()

    class Meta:
        model = Version
        fields = (
            "id", "uuid", "code", "version_number", "version_index",
            "project_id", "project_code",
            "entity_type", "entity_id", "entity_code", "entity_name",
            "shot_id", "asset_id", "task_id", "task_code", "task_title",
            "department", "artist_id", "artist_name",
            "status", "is_published", "published_at", "published_by_id", "is_hero", "is_archived",
            "thumbnail_url", "video_url", "source_file_url",
            "frame_range", "start_frame", "end_frame", "resolution", "fps", "file_size_mb", "color_space", "file_path",
            # No lists of what holds the version (C-RP-01; the JSON copies were dropped by RP-1): the reviews
            # and playlists of a version are read with ``?version_id=`` on their own lists (C-RP-03, C-RP-04).
            "notes", "changelog", "tags", "publishing_info",
            "review_media", "review_media_job",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")

    @extend_schema_field(ReviewMediaSerializer(allow_null=True))
    def get_review_media(self, obj):
        row = ReviewMediaSelector.current(obj)
        return ReviewMediaSerializer(row, context=self.context).data if row is not None else None

    @extend_schema_field(ReviewMediaSerializer(allow_null=True))
    def get_review_media_job(self, obj):
        row = ReviewMediaSelector.job(obj)
        return ReviewMediaSerializer(row, context=self.context).data if row is not None else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_task_code(self, obj) -> str | None:
        task = readable_task(self, obj)
        return task.code if task is not None else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_task_title(self, obj) -> str | None:
        task = readable_task(self, obj)
        return task.title if task is not None else None

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""
    def get_artist_name(self, obj):
        if obj.artist:
            profile = getattr(obj.artist, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.artist.email
        return ""
