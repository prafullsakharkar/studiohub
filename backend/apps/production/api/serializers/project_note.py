from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.production.models import ProjectNote
from apps.production.models.project_note import ProjectNoteStatus


class ProjectNoteSerializer(BaseReadSerializer[Any]):
    """
    Frontend ProjectNote shape (C-RP-08).

    ``links`` carry each record's code and name as they are now, read in one query per type for the
    whole page (``context["link_labels"]``, see ``ProjectNoteSelector.link_labels``); without it, the
    labels are read per note.
    """

    project_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    author_id = serializers.SerializerMethodField()
    parent_id = serializers.SerializerMethodField()
    links = serializers.SerializerMethodField()
    task_id = serializers.SerializerMethodField()
    task_code = serializers.SerializerMethodField()
    reply_count = serializers.SerializerMethodField()
    mentions = serializers.SerializerMethodField()

    class Meta:
        model = ProjectNote
        fields = (
            "id",
            "project_id",
            "project_code",
            "entity_type",
            "entity_id",
            "entity_code",
            "entity_name",
            "author_id",
            "author_name",
            "author_avatar",
            "author_role",
            "subject",
            "body",
            "category",
            "priority",
            "tags",
            "status",
            "addressed_by",
            "addressed_at",
            "timecode_ref",
            "frame_number",
            "created_at",
            "updated_at",
            "parent_id",
            "links",
            "task_id",
            "task_code",
            "reply_count",
            "mentions",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

    def get_project_code(self, obj) -> str:
        return obj.project.code if obj.project else ""

    def get_author_id(self, obj) -> str:
        return str(obj.author_id) if obj.author_id else ""

    def get_parent_id(self, obj) -> str | None:
        return str(obj.parent_id) if obj.parent_id else None

    def get_links(self, obj) -> list[dict[str, str]]:
        from apps.production.selectors.project_note import ProjectNoteSelector

        rows = list(obj.links.all())
        labels = self.context.get("link_labels")
        if labels is None:
            labels = ProjectNoteSelector.link_labels(rows)
        out = []
        for link in rows:
            code, name = labels.get((link.entity_type, link.entity_id), ("", ""))
            out.append(
                {
                    "entity_type": link.entity_type,
                    "entity_id": str(link.entity_id),
                    "code": code,
                    "name": name,
                }
            )
        return out

    def get_task_id(self, obj) -> str | None:
        return str(obj.task_id) if obj.task_id else None

    def get_task_code(self, obj) -> str | None:
        return obj.task.code if obj.task_id and obj.task else None

    def get_reply_count(self, obj) -> int:
        if obj.parent_id:
            return 0
        annotated = getattr(obj, "live_reply_count", None)
        if annotated is not None:
            return annotated
        return obj.replies.filter(is_deleted=False).count()

    def get_mentions(self, obj) -> list[dict[str, str]]:
        """The people the note mentions, in the order written (RP-6, C-RP-25)."""
        from apps.production.api.serializers.membership import _user_display_name

        return [
            {"id": str(mention.user_id), "name": _user_display_name(mention.user)}
            for mention in obj.mentions.all()
        ]


class ProjectNoteDetailSerializer(ProjectNoteSerializer):
    """One thread with its live replies, oldest first (C-RP-10)."""

    replies = serializers.SerializerMethodField()

    class Meta(ProjectNoteSerializer.Meta):
        fields = (*ProjectNoteSerializer.Meta.fields, "replies")

    def get_replies(self, obj) -> list[dict[str, Any]]:
        from apps.production.selectors.project_note import mentions_prefetch

        rows = (
            obj.replies.filter(is_deleted=False)
            .select_related("project", "author")
            .prefetch_related(mentions_prefetch())
            .order_by("created_at", "id")
        )
        return list(ProjectNoteSerializer(rows, many=True, context=self.context).data)


class NoteLinkInputSerializer(serializers.Serializer[Any]):
    """One record a note names. Checked by ``validators/project_note.py``, so every refusal reads the same."""

    entity_type = serializers.CharField(max_length=20)
    entity_id = serializers.CharField(max_length=64)


def _mention_ids_field():
    """Up to 20 user ids (C-RP-25); ``validators/project_note.resolve_mentions`` checks each one."""
    return serializers.ListField(
        child=serializers.CharField(max_length=64), required=False, allow_empty=True
    )


class ProjectNoteCreateSerializer(BaseWriteSerializer[Any]):
    """
    Accept frontend Partial<ProjectNote> (C-RP-07). Ownership, status and the records' code and name
    are the server's: ``entity_code``, ``entity_name``, ``status`` and the author fields are accepted
    for older clients and ignored.
    """

    links = NoteLinkInputSerializer(many=True, required=False)
    task_id = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=64
    )
    mention_ids = _mention_ids_field()

    class Meta:
        model = ProjectNote
        fields = (
            "entity_type",
            "entity_id",
            "entity_code",
            "entity_name",
            "author_name",
            "author_avatar",
            "author_role",
            "subject",
            "body",
            "category",
            "priority",
            "tags",
            "status",
            "timecode_ref",
            "frame_number",
            "links",
            "task_id",
            "mention_ids",
        )


class ProjectNoteUpdateSerializer(BaseWriteSerializer[Any]):
    """What a ``PATCH`` may change (C-RP-12); a reply takes only ``body`` (checked by the service)."""

    links = NoteLinkInputSerializer(many=True, required=False)
    task_id = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=64
    )
    mention_ids = _mention_ids_field()

    class Meta:
        model = ProjectNote
        fields = (
            "subject",
            "body",
            "category",
            "priority",
            "tags",
            "timecode_ref",
            "frame_number",
            "links",
            "task_id",
            "mention_ids",
        )


class ProjectNoteReplySerializer(serializers.Serializer[Any]):
    body = serializers.CharField(allow_blank=False, trim_whitespace=True)
    mention_ids = _mention_ids_field()


class ProjectNoteStatusSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=ProjectNoteStatus.choices)


__all__ = [
    "ProjectNoteCreateSerializer",
    "ProjectNoteDetailSerializer",
    "ProjectNoteReplySerializer",
    "ProjectNoteSerializer",
    "ProjectNoteStatusSerializer",
    "ProjectNoteUpdateSerializer",
]
