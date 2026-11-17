"""Review media shapes (docs/review-pipeline/CONTRACTS.md C-RP-19 to C-RP-21; C-RP-31, C-RP-32; C-RP-37, C-RP-38)."""

from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.production.models import ReviewMedia
from apps.production.services import review_media_links
from apps.production.transcode import sequence as frames

#: what the probe shows (``frame_rate``, the exact rational, stays internal)
PROBE_KEYS = ("width", "height", "fps", "frames", "duration_seconds", "video_codec", "has_audio")
#: added by RP-12 (C-RP-32), with what a row made before it answers
PROBE_DEFAULTS = {"first_frame": None, "last_frame": None, "colour": "as_stored", "burn_ins": False}


class ReviewMediaProbeSerializer(serializers.Serializer[Any]):
    width = serializers.IntegerField()
    height = serializers.IntegerField()
    fps = serializers.FloatField()
    frames = serializers.IntegerField()
    duration_seconds = serializers.FloatField()
    video_codec = serializers.CharField()
    has_audio = serializers.BooleanField()
    first_frame = serializers.IntegerField(allow_null=True)
    last_frame = serializers.IntegerField(allow_null=True)
    colour = serializers.ChoiceField(choices=("srgb_from_linear", "as_stored"))
    burn_ins = serializers.BooleanField()


class ReviewMediaSequenceSerializer(serializers.Serializer[Any]):
    name = serializers.CharField()
    extension = serializers.CharField()
    first_frame = serializers.IntegerField()
    last_frame = serializers.IntegerField()
    frames_received = serializers.IntegerField()


class ReviewMediaUserSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    name = serializers.CharField()


def _user_name(user: Any) -> str:
    profile = getattr(user, "profile", None)
    return getattr(profile, "display_name", "") or user.email


class ReviewMediaSerializer(serializers.ModelSerializer[ReviewMedia]):
    version_id = serializers.UUIDField(read_only=True)
    probe = serializers.SerializerMethodField()
    sequence = serializers.SerializerMethodField()
    error_message = serializers.CharField(read_only=True)
    created_by = serializers.SerializerMethodField()
    proxy_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    filmstrip_url = serializers.SerializerMethodField()
    links_expire_at = serializers.SerializerMethodField()
    remake_of = serializers.UUIDField(source="remake_of_id", read_only=True, allow_null=True)

    class Meta:
        model = ReviewMedia
        fields = (
            "id", "version_id", "kind", "status",
            "source_name", "source_size", "probe", "sequence",
            "error_code", "error_message", "attempts",
            "queued_at", "started_at", "finished_at", "created_by",
            "proxy_url", "thumbnail_url", "filmstrip_url", "filmstrip_tiles", "links_expire_at",
            "remake_of",
        )  # fmt: skip
        read_only_fields = fields

    @extend_schema_field(ReviewMediaProbeSerializer(allow_null=True))
    def get_probe(self, obj: ReviewMedia) -> dict[str, Any] | None:
        if not obj.probe:
            return None
        shown = {key: obj.probe.get(key) for key in PROBE_KEYS}
        return shown | {key: obj.probe.get(key, default) for key, default in PROBE_DEFAULTS.items()}

    @extend_schema_field(ReviewMediaSequenceSerializer(allow_null=True))
    def get_sequence(self, obj: ReviewMedia) -> dict[str, Any] | None:
        if obj.kind != ReviewMedia.Kind.SEQUENCE:
            return None
        return {
            "name": obj.sequence_name,
            "extension": obj.sequence_extension,
            "first_frame": obj.first_frame,
            "last_frame": obj.last_frame,
            "frames_received": obj.frames_received,
        }

    @extend_schema_field(ReviewMediaUserSerializer(allow_null=True))
    def get_created_by(self, obj: ReviewMedia) -> dict[str, Any] | None:
        user = obj.created_by
        return {"id": user.pk, "name": _user_name(user)} if user is not None else None

    def _viewer(self) -> Any:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return user if getattr(user, "is_authenticated", False) else None

    def _link(self, obj: ReviewMedia, output: str, stored: str) -> str | None:
        viewer = self._viewer()
        if obj.status != ReviewMedia.Status.READY or not stored or viewer is None:
            return None
        return review_media_links.stream_path(obj, viewer, output)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_proxy_url(self, obj: ReviewMedia) -> str | None:
        return self._link(obj, "proxy", obj.proxy_path)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_thumbnail_url(self, obj: ReviewMedia) -> str | None:
        return self._link(obj, "thumbnail", obj.thumbnail_path)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_filmstrip_url(self, obj: ReviewMedia) -> str | None:
        return self._link(obj, "filmstrip", obj.filmstrip_path)

    @extend_schema_field(serializers.DateTimeField(allow_null=True))
    def get_links_expire_at(self, obj: ReviewMedia) -> str | None:
        if obj.status != ReviewMedia.Status.READY or self._viewer() is None:
            return None
        return serializers.DateTimeField().to_representation(review_media_links.expires_at())


class ReviewMediaUploadSerializer(serializers.Serializer[Any]):
    #: size, extension and content are checked by the service (one message each)
    file = serializers.FileField(allow_empty_file=True, use_url=False)


class ReviewMediaSequenceOpenSerializer(serializers.Serializer[Any]):
    """``POST versions/{id}/review-media/sequence/`` (C-RP-31); the rules are the service's."""

    name = serializers.CharField(max_length=frames.NAME_MAX_LENGTH, trim_whitespace=False)
    extension = serializers.CharField(max_length=10)
    first_frame = serializers.IntegerField()
    last_frame = serializers.IntegerField()


class ReviewMediaFramesSerializer(serializers.Serializer[Any]):
    """``POST review-media/{id}/frames/``: up to 50 files under ``frames`` (C-RP-31)."""

    frames = serializers.ListField(
        child=serializers.FileField(allow_empty_file=True, use_url=False),
        allow_empty=False,
    )


class ReviewMediaFramesResultSerializer(serializers.Serializer[Any]):
    frames_received = serializers.IntegerField()
    frames_expected = serializers.IntegerField()
    missing_frames = serializers.ListField(child=serializers.IntegerField())


class ReviewCopiesSerializer(serializers.Serializer[Any]):
    """``GET projects/{id}/review-copies/`` (C-RP-38)."""

    review_burn_ins = serializers.BooleanField()
    out_of_date = serializers.IntegerField()
    sequences_out_of_date = serializers.IntegerField()


class ReviewCopiesRemadeSerializer(serializers.Serializer[Any]):
    """``POST projects/{id}/review-copies/remake/`` (C-RP-38)."""

    queued = serializers.IntegerField()
    skipped_busy = serializers.IntegerField()
    skipped_sequence = serializers.IntegerField()
    skipped_missing = serializers.IntegerField()
