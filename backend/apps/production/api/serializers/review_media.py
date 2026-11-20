"""Review media shapes (docs/review-pipeline/CONTRACTS.md C-RP-19 to C-RP-21; C-RP-31, C-RP-32; C-RP-37 to C-RP-40)."""

from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.production.api.serializers.shot.base import ShotGradeSerializer
from apps.production.models import ReviewMedia
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.services import review_media_links
from apps.production.transcode import sequence as frames

#: what the probe shows (``frame_rate``, the exact rational, stays internal)
PROBE_KEYS = ("width", "height", "fps", "frames", "duration_seconds", "video_codec", "has_audio")
#: added by RP-12 (C-RP-32), RP-15 (C-RP-40), RP-20 (C-RP-53) and RP-25 (C-RP-59), with what a row made
#: before them answers
PROBE_DEFAULTS = {
    "first_frame": None,
    "last_frame": None,
    "colour": "as_stored",
    "burn_ins": False,
    "ocio": None,
    "colour_skipped": None,
    # RP-20 (C-RP-53)
    "grade": None,
    "grade_source": "",
    "grade_skipped": None,
    # RP-25 (C-RP-59)
    "slate": False,
    "slate_skipped": None,
}

#: RP-18 (C-RP-49): where a copy is read from
SOURCES = (
    ("upload", "upload"),
    ("published_file", "published_file"),
    ("storage_path", "storage_path"),
)


class ReviewMediaColourSerializer(serializers.Serializer[Any]):
    """How a copy's colour was made (C-RP-40): the config's names, never a path."""

    config = serializers.CharField()
    input = serializers.CharField()
    display = serializers.CharField()
    view = serializers.CharField()
    look = serializers.CharField(allow_blank=True)


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
    colour = serializers.ChoiceField(choices=("ocio", "srgb_from_linear", "as_stored"))
    burn_ins = serializers.BooleanField()
    ocio = ReviewMediaColourSerializer(allow_null=True)
    colour_skipped = serializers.ChoiceField(
        choices=("unknown_colour_space", "colour_config_unavailable"), allow_null=True
    )
    #: RP-20 (C-RP-53): the shot's grade the copy was made with, where it came from, or why none
    grade = ShotGradeSerializer(allow_null=True)
    grade_source = serializers.CharField(allow_blank=True)
    grade_skipped = serializers.ChoiceField(
        choices=("no_grading_space", "colour_config_unavailable"), allow_null=True
    )
    #: RP-25 (C-RP-59): whether the download starts with a slate, or why it does not
    slate = serializers.BooleanField()
    slate_skipped = serializers.ChoiceField(
        choices=("slate_failed", "font_missing"), allow_null=True
    )


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
    #: RP-23 (C-RP-56): a link that saves the copy, while the project lets this viewer download
    download_url = serializers.SerializerMethodField()
    links_expire_at = serializers.SerializerMethodField()
    remake_of = serializers.UUIDField(source="remake_of_id", read_only=True, allow_null=True)
    frames_until = serializers.SerializerMethodField()
    published_file_id = serializers.UUIDField(read_only=True, allow_null=True)
    storage_readable = serializers.SerializerMethodField()
    #: RP-18 (C-RP-49): where the copy is read from
    source = serializers.ChoiceField(choices=SOURCES, read_only=True)  # pyright: ignore[reportAssignmentType]  # DRF pops declared fields; Field.source is unrelated

    class Meta:
        model = ReviewMedia
        fields = (
            "id", "version_id", "kind", "status",
            "source_name", "source_size", "probe", "sequence",
            "error_code", "error_message", "attempts",
            "queued_at", "started_at", "finished_at", "created_by",
            "proxy_url", "thumbnail_url", "filmstrip_url", "filmstrip_tiles", "download_url",
            "links_expire_at",
            "remake_of", "color_space", "frames_until", "published_file_id", "storage_readable",
            "source",
        )  # fmt: skip
        read_only_fields = fields

    @extend_schema_field(serializers.DateTimeField(allow_null=True))
    def get_frames_until(self, obj: ReviewMedia) -> Any:
        """RP-16 (C-RP-41): until when a sequence's frames are kept to remake it; ``null`` once gone."""
        return (
            serializers.DateTimeField().to_representation(obj.frames_until)
            if obj.frames_kept
            else None
        )

    @extend_schema_field(serializers.BooleanField())
    def get_storage_readable(self, obj: ReviewMedia) -> bool:
        """RP-17 (C-RP-44, C-RP-46): a copy read from a published file that can still be read, so it can
        be remade; ``false`` for uploads, revoked files and roots the server no longer reads. RP-18
        (C-RP-49): a copy read by path while it is still in the project's review folder."""
        return obj.storage_copy and ReviewMediaSelector.remakable(obj)

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

    @staticmethod
    def _downloads(request: Any, project_id: Any) -> str:
        """The project's ``review_downloads``, read once per request: a list serializes many rows."""
        cache = getattr(request, "_review_downloads", None)
        if cache is None:
            cache = {}
            if request is not None:
                request._review_downloads = cache
        if project_id not in cache:
            cache[project_id] = review_media_links.downloads_of(project_id)
        return cache[project_id]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_download_url(self, obj: ReviewMedia) -> str | None:
        """RP-23 (C-RP-56): the copy as an attachment, or ``null`` when this viewer may not download it."""
        if obj.status != ReviewMedia.Status.READY or not obj.proxy_path:
            return None
        request = self.context.get("request")
        project_id = obj.project_id  # pyright: ignore[reportAttributeAccessIssue]
        external = ProductionBaseSelector.is_external_on(request, project_id)
        if not review_media_links.may_download(
            self._downloads(request, project_id), external=external
        ):
            return None
        return self._link(obj, "download", obj.proxy_path)

    @extend_schema_field(serializers.DateTimeField(allow_null=True))
    def get_links_expire_at(self, obj: ReviewMedia) -> str | None:
        if obj.status != ReviewMedia.Status.READY or self._viewer() is None:
            return None
        return serializers.DateTimeField().to_representation(review_media_links.expires_at())


class ReviewMediaUploadSerializer(serializers.Serializer[Any]):
    #: size, extension and content are checked by the service (one message each)
    file = serializers.FileField(allow_empty_file=True, use_url=False)
    #: RP-15 (C-RP-40): the movie's or still's colour space, when it is not display-ready
    color_space = serializers.CharField(max_length=100, required=False, allow_blank=True)


class ReviewMediaSequenceOpenSerializer(serializers.Serializer[Any]):
    """``POST versions/{id}/review-media/sequence/`` (C-RP-31); the rules are the service's."""

    name = serializers.CharField(max_length=frames.NAME_MAX_LENGTH, trim_whitespace=False)
    extension = serializers.CharField(max_length=10)
    first_frame = serializers.IntegerField()
    last_frame = serializers.IntegerField()
    #: RP-15 (C-RP-40): the frames' colour space; blank = the project's for EXR, none otherwise
    color_space = serializers.CharField(max_length=100, required=False, allow_blank=True)


class ReviewMediaFromStorageSerializer(serializers.Serializer[Any]):
    """``POST versions/{id}/review-media/from-storage/`` (RP-18, C-RP-48): a render in the project's
    review folder. ``path`` is relative to the folder; a frame pattern needs both frames."""

    path = serializers.CharField(max_length=1024, trim_whitespace=False)
    first_frame = serializers.IntegerField(required=False, allow_null=True)
    last_frame = serializers.IntegerField(required=False, allow_null=True)
    color_space = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        unknown = sorted(set(getattr(data, "keys", lambda: [])()) - set(self.fields))
        if unknown:
            raise serializers.ValidationError({name: ["Unknown field."] for name in unknown})
        return super().to_internal_value(data)


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


class ReviewCopyVersionSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()


class ReviewCopyDifferingSerializer(serializers.Serializer[Any]):
    """One copy made with other settings than its project has now (C-RP-42)."""

    review_media_id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=ReviewMedia.Kind.choices)
    version = ReviewCopyVersionSerializer()
    record_code = serializers.CharField(allow_blank=True)
    remakable = serializers.BooleanField()
    frames_until = serializers.DateTimeField(allow_null=True)
    published_file_id = serializers.UUIDField(allow_null=True)
    source = serializers.ChoiceField(choices=SOURCES)  # pyright: ignore[reportAssignmentType]  # DRF pops declared fields; Field.source is unrelated
    why = serializers.ListField(
        child=serializers.ChoiceField(choices=["burn_ins", "colour", "grade"])
    )


class ReviewCopiesSerializer(serializers.Serializer[Any]):
    """``GET projects/{id}/review-copies/`` (C-RP-38, C-RP-40, C-RP-42)."""

    review_burn_ins = serializers.BooleanField()
    out_of_date = serializers.IntegerField()
    sequences_out_of_date = serializers.IntegerField()
    colour_out_of_date = serializers.IntegerField()
    #: RP-20 (C-RP-53)
    review_grades = serializers.BooleanField()
    grade_out_of_date = serializers.IntegerField()
    #: RP-25 (C-RP-60)
    review_slates = serializers.BooleanField()
    slate_out_of_date = serializers.IntegerField()
    differing = ReviewCopyDifferingSerializer(many=True)
    differing_more = serializers.IntegerField()


class ReviewCopiesKeepSerializer(serializers.Serializer[Any]):
    """``POST projects/{id}/review-copies/keep/`` (C-RP-43): the copies to keep as they are."""

    review_media_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=100
    )

    def validate_review_media_ids(self, value: list[Any]) -> list[Any]:
        return list(dict.fromkeys(value))


class ReviewCopiesKeptSerializer(serializers.Serializer[Any]):
    kept = serializers.IntegerField()


class ReviewCopiesRemadeSerializer(serializers.Serializer[Any]):
    """``POST projects/{id}/review-copies/remake/`` (C-RP-38)."""

    queued = serializers.IntegerField()
    skipped_busy = serializers.IntegerField()
    skipped_sequence = serializers.IntegerField()
    skipped_missing = serializers.IntegerField()
    skipped_storage = serializers.IntegerField()


class ReviewColourSpaceSerializer(serializers.Serializer[Any]):
    name = serializers.CharField()
    family = serializers.CharField(allow_blank=True)
    encoding = serializers.CharField(allow_blank=True)
    aliases = serializers.ListField(child=serializers.CharField())


class ReviewColourSerializer(serializers.Serializer[Any]):
    """``GET review-media/colour/`` (C-RP-39)."""

    available = serializers.BooleanField()
    config = serializers.CharField(allow_null=True)
    display = serializers.CharField(allow_null=True)
    default_view = serializers.CharField(allow_null=True)
    views = serializers.ListField(child=serializers.CharField())
    looks = serializers.ListField(child=serializers.CharField())
    color_spaces = ReviewColourSpaceSerializer(many=True)
