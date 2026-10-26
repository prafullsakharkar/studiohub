"""
Request bodies of the custom actions.

Every action that reads ``request.data`` validates it with one of these, so
the OpenAPI schema shows the body and a body with keys the action does not
know is a 400 instead of being merged into stored JSON.

``Strict*`` serializers describe closed bodies: an undeclared key is rejected.
``Open*`` serializers describe the free-form blobs the frontend types define
with an index signature (publishing info, playlist entries, share settings):
declared keys are typed, other keys pass through, and keys the server owns are
set by the server only.
"""

from __future__ import annotations

from typing import Any

from rest_framework import serializers


class StrictSerializer(serializers.Serializer):  # type: ignore[type-arg]  # pyright: ignore[reportMissingTypeArgument]
    """Rejects keys the serializer does not declare."""

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError({"non_field_errors": ["Expected an object."]})
        unknown = sorted(set(data.keys()) - set(self.fields))
        if unknown:
            raise serializers.ValidationError({key: ["Unknown field."] for key in unknown})
        return super().to_internal_value(data)


class OpenSerializer(serializers.Serializer):  # type: ignore[type-arg]  # pyright: ignore[reportMissingTypeArgument]
    """Types the declared keys and passes the others through."""

    #: keys the client may not set; they are dropped from the passed-through rest
    reserved_keys: tuple[str, ...] = ()

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError({"non_field_errors": ["Expected an object."]})
        validated = super().to_internal_value(data)
        for key in data:
            if key not in self.fields and key not in self.reserved_keys:
                validated[key] = data[key]
        return validated


# -- tasks -----------------------------------------------------------------


class TaskIdsSerializer(StrictSerializer):
    task_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)


class BulkAssignSerializer(TaskIdsSerializer):
    assignee_id = serializers.UUIDField(required=False, allow_null=True)
    team_id = serializers.UUIDField(required=False, allow_null=True)


class BulkStatusSerializer(TaskIdsSerializer):
    status = serializers.CharField(max_length=30)


# -- versions --------------------------------------------------------------


class VersionPublishingInfoSerializer(OpenSerializer):
    dcc_software = serializers.CharField(required=False, allow_blank=True)
    dcc_version = serializers.CharField(required=False, allow_blank=True)
    usd_stage_path = serializers.CharField(required=False, allow_blank=True)
    usd_layer_identifier = serializers.CharField(required=False, allow_blank=True)
    pyblish_status = serializers.CharField(required=False, allow_blank=True)
    is_hero_promoted = serializers.BooleanField(required=False)
    published_at = serializers.CharField(required=False, allow_blank=True)
    publisher_name = serializers.CharField(required=False, allow_blank=True)
    publisher_id = serializers.CharField(required=False, allow_blank=True)
    comment = serializers.CharField(required=False, allow_blank=True)
    reserved_keys = ("id",)


class PublishVersionSerializer(OpenSerializer):
    """Publishing info, either nested under ``publishing_info`` or sent flat."""

    publishing_info = VersionPublishingInfoSerializer(required=False)

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError({"non_field_errors": ["Expected an object."]})
        nested = data.get("publishing_info")
        info = VersionPublishingInfoSerializer(data=nested if isinstance(nested, dict) else data)
        info.is_valid(raise_exception=True)
        return {"publishing_info": dict(info.validated_data)}


class AddToPlaylistSerializer(StrictSerializer):
    playlist_id = serializers.UUIDField(required=False, allow_null=True)
    playlist_name = serializers.CharField(required=False, allow_blank=True, max_length=255)


# -- timelogs --------------------------------------------------------------


class RejectTimelogSerializer(StrictSerializer):
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


# -- playlists -------------------------------------------------------------


class AddEntrySerializer(OpenSerializer):
    """A playlist entry; ``id`` and ``item_order`` are assigned by the server."""

    version_id = serializers.UUIDField(required=False, allow_null=True)
    reserved_keys = ("id", "item_order")


class RemoveEntrySerializer(StrictSerializer):
    entry_id = serializers.CharField()


class ReorderEntriesSerializer(StrictSerializer):
    entries = serializers.ListField(child=serializers.DictField(), required=False)


class ShareSettingsSerializer(OpenSerializer):
    is_public = serializers.BooleanField(required=False)
    allow_client_approval = serializers.BooleanField(required=False)
    require_passcode = serializers.BooleanField(required=False)
    client_id = serializers.CharField(required=False, allow_blank=True)
    expires_at = serializers.CharField(required=False, allow_blank=True, allow_null=True)


# -- reviews ---------------------------------------------------------------


class ReviewNotesSerializer(StrictSerializer):
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ReviewVerdictSerializer(ReviewNotesSerializer):
    verdict = serializers.CharField(required=False, max_length=30, default="Pending Review")


class ParticipantVerdictSerializer(ReviewVerdictSerializer):
    participant_id = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AnnotationSerializer(StrictSerializer):
    frame_number = serializers.IntegerField(required=False, allow_null=True)
    timecode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    author_name = serializers.CharField(required=False, allow_blank=True)
    comment = serializers.CharField(required=False, allow_blank=True, default="")
    drawing_coordinates = serializers.JSONField(required=False, allow_null=True)


class ReviewCommentSerializer(StrictSerializer):
    frame_number = serializers.IntegerField(required=False, allow_null=True)
    timecode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    author = serializers.CharField(required=False, allow_blank=True)
    text = serializers.CharField(required=False, allow_blank=True)
    comment = serializers.CharField(required=False, allow_blank=True)
    is_client_visible = serializers.BooleanField(required=False, default=True)
    tags = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class ReviewNoteSerializer(StrictSerializer):
    category = serializers.CharField(required=False, default="General", max_length=50)
    author_name = serializers.CharField(required=False, allow_blank=True)
    author_role = serializers.CharField(required=False, allow_blank=True, default="")
    content = serializers.CharField(required=False, allow_blank=True, default="")
    is_pinned = serializers.BooleanField(required=False, default=False)


# -- scheduling ------------------------------------------------------------


class ResolveOverbookingSerializer(StrictSerializer):
    alert_id = serializers.CharField()
    resource_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


def validated(serializer_class: type[serializers.Serializer], data: Any) -> dict[str, Any]:  # type: ignore[type-arg]  # pyright: ignore[reportMissingTypeArgument]
    """Validate ``data`` with ``serializer_class``; a bad body is a 400."""
    serializer = serializer_class(data=data)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)
