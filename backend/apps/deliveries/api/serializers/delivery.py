"""
Delivery serializers.
"""

import json
from typing import Any

from rest_framework import serializers

from apps.deliveries.models import (
    DeliveryItemFile,
    DeliveryPackage,
    DeliveryQCCheck,
    DeliveryStatusChange,
    DeliveryVersionRef,
)
from apps.deliveries.services.destination import address
from apps.deliveries.services.package import DeliveryService
from apps.publishing.selectors.files import PublishedFileSelector

# Backend status -> frontend contract words (types/deliveries.ts
# DeliveryStatus). DB keeps backend words; only the read shape is mapped.
STATUS_OUTPUT_MAP = {
    DeliveryPackage.STATUS_PREPARED: "Ready",
    DeliveryPackage.STATUS_COMPLETE: "Completed",
}


def derived_totals(package) -> tuple[int, int]:
    """Total bytes and frames, summed from the items' snapshots (the stored columns are deprecated)."""
    refs = list(package.versions.all())
    return (
        sum(ref.file_size_bytes or 0 for ref in refs),
        sum(ref.frame_count or 0 for ref in refs),
    )


class DeliveryItemFileSerializer(serializers.ModelSerializer[DeliveryItemFile]):
    """One file of an item, as copied from the published file registry."""

    class Meta:
        model = DeliveryItemFile
        fields = (
            "storage_root_code",
            "relative_path",
            "role",
            "file_type_code",
            "size_bytes",
            "sha256",
            "frame_start",
            "frame_end",
            "frozen_at",
        )
        read_only_fields = fields


class DeliveryVersionRefSerializer(serializers.ModelSerializer[DeliveryVersionRef]):
    """Serializer for delivery version references. Everything about the files is the server's."""

    version_id = serializers.UUIDField(source="version.id", read_only=True)
    version_number = serializers.CharField(read_only=True)
    entity_type = serializers.CharField(read_only=True)
    entity_code = serializers.CharField(read_only=True)
    entity_name = serializers.CharField(read_only=True)
    files = DeliveryItemFileSerializer(many=True, read_only=True)

    class Meta:
        model = DeliveryVersionRef
        fields = (
            "id",
            "uid",
            "version_id",
            "version_number",
            "entity_type",
            "entity_code",
            "entity_name",
            "file_size_bytes",
            "frame_count",
            "file_path",
            "checksum_md5",
            "checksum_sha256",
            "is_validated",
            "validation_notes",
            "files",
            "created_at",
        )
        read_only_fields = fields


class DeliveryListSerializer(serializers.ModelSerializer[DeliveryPackage]):
    """Serializer for delivery list view."""

    client_name = serializers.CharField(source="client.name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    version_count = serializers.IntegerField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    status = serializers.SerializerMethodField()
    total_size_bytes = serializers.SerializerMethodField()
    total_frames = serializers.SerializerMethodField()

    def get_status(self, obj):
        # Frontend contract words (types/deliveries.ts DeliveryStatus):
        # backend Prepared/Complete read as Ready/Completed.
        return STATUS_OUTPUT_MAP.get(obj.status, obj.status)

    def get_total_size_bytes(self, obj) -> int:
        return derived_totals(obj)[0]

    def get_total_frames(self, obj) -> int:
        return derived_totals(obj)[1]

    class Meta:
        model = DeliveryPackage
        fields = (
            "id",
            "name",
            "code",
            "status",
            "client_status",
            "delivery_method",
            "version_count",
            "total_size_bytes",
            "total_frames",
            "client_name",
            "project_name",
            "expires_at",
            "is_expired",
            "is_archived",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class DeliveryDetailSerializer(serializers.ModelSerializer[DeliveryPackage]):
    """Serializer for delivery detail view."""

    client = serializers.UUIDField(source="client.id", read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    project = serializers.UUIDField(source="project.id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    versions = DeliveryVersionRefSerializer(many=True, read_only=True)
    status = serializers.SerializerMethodField()
    total_size_bytes = serializers.SerializerMethodField()
    total_frames = serializers.SerializerMethodField()
    # The passcode is never returned (DLV-01). Whether one is set is.
    has_passcode = serializers.SerializerMethodField()

    def get_status(self, obj):
        return STATUS_OUTPUT_MAP.get(obj.status, obj.status)

    def get_total_size_bytes(self, obj) -> int:
        return derived_totals(obj)[0]

    def get_total_frames(self, obj) -> int:
        return derived_totals(obj)[1]

    def get_has_passcode(self, obj) -> bool:
        return bool(obj.passcode)

    has_revoked_content = serializers.SerializerMethodField()
    destination = serializers.UUIDField(source="destination_id", read_only=True)
    destination_name = serializers.CharField(source="destination.name", read_only=True, default="")
    # Deprecated free text: with a destination chosen, that destination's own address.
    delivery_destination = serializers.SerializerMethodField()

    def get_delivery_destination(self, obj) -> str:
        return address(obj.destination) if obj.destination_id else obj.delivery_destination

    def get_has_revoked_content(self, obj) -> bool:
        """Whether a file recorded in this delivery has been revoked since (read from Publishing)."""
        recorded = {
            file.published_file_id for ref in obj.versions.all() for file in ref.files.all()
        }
        return bool(recorded) and bool(PublishedFileSelector.revoked_file_ids(recorded))

    class Meta:
        model = DeliveryPackage
        fields = (
            "id",
            "name",
            "code",
            "status",
            "client_status",
            "delivery_method",
            "destination",
            "destination_name",
            "delivery_destination",
            "has_passcode",
            "has_revoked_content",
            "expires_at",
            "total_size_bytes",
            "total_frames",
            "notes",
            "client_notes",
            "manifest_data",
            "checksums",
            "is_archived",
            "client",
            "client_name",
            "project",
            "project_name",
            "sent_at",
            "transfer_reference",
            "signed_off_by",
            "signed_off_at",
            "client_answered_by",
            "client_answered_at",
            "cancellation_reason",
            "rejection_reason",
            "revision_of",
            "versions",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class DeliveryCreateSerializer(serializers.Serializer[Any]):
    """
    Body of ``POST /deliveries/``. Rules (project, client, numbering) are the service's.

    A blank code is numbered by the server from ``project_id``. The passcode is write-only.
    """

    id = serializers.UUIDField(read_only=True)
    code = serializers.CharField(required=False, allow_blank=True, max_length=50)
    name = serializers.CharField(required=True, max_length=255)
    # A project id or code; the service resolves it and answers "Unknown project." for any miss.
    project_id = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=64
    )
    client_id = serializers.UUIDField(required=False, allow_null=True)
    delivery_method = serializers.ChoiceField(
        choices=["Aspera", "S3", "FTP", "Web Download"],
        default="S3",
    )
    destination_id = serializers.UUIDField(required=False, allow_null=True)
    delivery_destination = serializers.CharField(required=False, allow_blank=True)
    passcode = serializers.CharField(
        required=False, allow_blank=True, max_length=64, write_only=True
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    client_notes = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        request = self.context.get("request")
        return DeliveryService.create(
            actor=getattr(request, "user", None), data=validated_data, request=request
        )


class DeliveryUpdateSerializer(serializers.Serializer[Any]):
    """
    Body of ``PATCH``/``PUT``. Editable only before the delivery is sent (the service checks).

    The status, code, client status, totals, manifest and archive flag are not editable: sending
    a different value is a 400 "Cannot be set directly", sending the current one (an echo, as a
    full ``PUT`` does) is accepted. Both the stored status and the word the API shows for it count
    as current.
    """

    READ_ONLY_ECHO = {
        "status": lambda p: {p.status, STATUS_OUTPUT_MAP.get(p.status, p.status)},
        "code": lambda p: {p.code},
        "client_status": lambda p: {p.client_status},
        "is_archived": lambda p: {p.is_archived},
        "total_size_bytes": lambda p: {derived_totals(p)[0], p.total_size_bytes},
        "total_frames": lambda p: {derived_totals(p)[1], p.total_frames},
        "manifest_data": lambda p: {json.dumps(p.manifest_data, sort_keys=True)},
        "checksums": lambda p: {json.dumps(p.checksums, sort_keys=True)},
        "destination": lambda p: {str(p.destination_id) if p.destination_id else None},
    }

    name = serializers.CharField(required=False, max_length=255)
    delivery_method = serializers.ChoiceField(
        choices=["Aspera", "S3", "FTP", "Web Download"],
        required=False,
    )
    destination_id = serializers.UUIDField(required=False, allow_null=True)
    delivery_destination = serializers.CharField(required=False, allow_blank=True)
    passcode = serializers.CharField(
        required=False, allow_blank=True, max_length=64, write_only=True
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    client_notes = serializers.CharField(required=False, allow_blank=True)

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        package = self.instance
        refused = {}
        if package is not None and hasattr(data, "get"):
            for name, current in self.READ_ONLY_ECHO.items():
                if name not in data:
                    continue
                sent = data[name]
                comparable = (
                    json.dumps(sent, sort_keys=True) if isinstance(sent, (dict, list)) else sent
                )
                if comparable not in current(package):
                    refused[name] = ["Cannot be set directly."]
        if refused:
            raise serializers.ValidationError(refused)
        return super().to_internal_value(data)

    def update(self, instance, validated_data):
        request = self.context.get("request")
        return DeliveryService.update(
            actor=getattr(request, "user", None), package=instance, data=validated_data
        )


class DeliveryAddVersionSerializer(serializers.Serializer[Any]):
    """
    Body of ``add-version``: only ``version_id`` counts. The version number, the shot or asset, the
    files, sizes and checksums come from the published file registry; the keys older clients still
    send for them are accepted and ignored.
    """

    version_id = serializers.UUIDField(required=True)
    version_number = serializers.CharField(required=False, allow_blank=True, max_length=50)
    entity_type = serializers.CharField(required=False, allow_blank=True, max_length=50)
    entity_code = serializers.CharField(required=False, allow_blank=True, max_length=255)
    entity_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    file_size_bytes = serializers.IntegerField(required=False)
    frame_count = serializers.IntegerField(required=False)
    file_path = serializers.CharField(required=False, allow_blank=True, max_length=500)
    checksum_md5 = serializers.CharField(required=False, allow_blank=True, max_length=32)
    checksum_sha256 = serializers.CharField(required=False, allow_blank=True, max_length=64)


class DeliveryRemoveVersionSerializer(serializers.Serializer[Any]):
    """Body of ``remove-version``: the item's ``uid``, or the older integer ``version_ref_id``."""

    version_ref_id = serializers.IntegerField(required=False)
    item_id = serializers.UUIDField(required=False)

    def validate(self, attrs):
        if "item_id" not in attrs and "version_ref_id" not in attrs:
            raise serializers.ValidationError("Send item_id (or the older version_ref_id).")
        return attrs


class DeliveryValidateSerializer(serializers.Serializer[Any]):
    """The validate action takes no body."""


class DeliveryPrepareSerializer(serializers.Serializer[Any]):
    """The prepare action takes no body."""


class DeliverySubmitSerializer(serializers.Serializer[Any]):
    """Body of the submit action: the id of the transfer made outside StudioHub, if any."""

    transfer_reference = serializers.CharField(required=False, allow_blank=True, max_length=200)


class DeliverySignOffSerializer(serializers.Serializer[Any]):
    """
    Body of ``sign-off``. ``override_reason`` is only for someone who prepared the delivery and
    holds ``delivery.sod.override``; the service decides, this only carries it.
    """

    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    override_reason = serializers.CharField(required=False, allow_blank=True, max_length=500)


class AliasedBody(serializers.Serializer[Any]):
    """
    A body that accepts the frontend's spelling beside the backend's (decision Q18).

    ``ALIASES`` maps the backend name to the frontend's (``{"rejection_reason": "reason"}``). Either
    may be sent; both at once must agree, else it is a 400 (never a silent pick). The old spellings
    stay accepted indefinitely (Q38).
    """

    ALIASES: dict[str, str] = {}

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if hasattr(data, "get") and self.ALIASES:
            data = dict(data.items())
            for name, alias in self.ALIASES.items():
                if alias not in data:
                    continue
                if name in data and data[name] != data[alias]:
                    raise serializers.ValidationError(
                        {alias: [f"Differs from {name}. Send only one of the two."]}
                    )
                data.setdefault(name, data[alias])
                del data[alias]
        return super().to_internal_value(data)


class DeliveryApproveSerializer(AliasedBody):
    """The client approved: ``client_notes`` (or ``notes``) is their feedback, if any."""

    ALIASES = {"client_notes": "notes"}

    client_notes = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True, write_only=True)


class DeliveryRejectSerializer(AliasedBody):
    """The client rejected: ``rejection_reason`` (or ``reason``) is required, kept in its own column."""

    ALIASES = {"rejection_reason": "reason"}

    rejection_reason = serializers.CharField(required=True, allow_blank=False, max_length=500)
    reason = serializers.CharField(
        required=False, allow_blank=True, max_length=500, write_only=True
    )


class DeliveryCancelSerializer(AliasedBody):
    ALIASES = {"cancellation_reason": "reason"}

    cancellation_reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
    reason = serializers.CharField(
        required=False, allow_blank=True, max_length=500, write_only=True
    )


class DeliveryBulkCancelSerializer(DeliveryCancelSerializer):
    """Body of ``bulk-cancel``: 1 to 100 distinct delivery ids and one reason for all of them."""

    ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=100, allow_empty=False
    )

    def validate_ids(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Each id may appear once.")
        return value


class BulkResultSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    ok = serializers.BooleanField()
    #: null on success, else ``not_found`` or ``invalid_transition``
    error = serializers.CharField(allow_null=True)


class DeliveryBulkCancelResponseSerializer(serializers.Serializer[Any]):
    success = serializers.BooleanField()
    succeeded_count = serializers.IntegerField()
    failed_count = serializers.IntegerField()
    results = BulkResultSerializer(many=True)


class DeliveryPasscodeResponseSerializer(serializers.Serializer[Any]):
    passcode = serializers.CharField(allow_blank=True)


class SkippedVersionSerializer(serializers.Serializer[Any]):
    version_id = serializers.UUIDField()
    reason = serializers.CharField()


class DeliveryReviseResponseSerializer(DeliveryDetailSerializer):
    """The new Draft, with the versions that could not be carried over."""

    skipped_versions = SkippedVersionSerializer(many=True, read_only=True)

    class Meta(DeliveryDetailSerializer.Meta):
        fields = (*DeliveryDetailSerializer.Meta.fields, "skipped_versions")
        read_only_fields = fields


class DeliveryReopenSerializer(serializers.Serializer[Any]):
    """The reopen action takes no body."""


class DeliveryReviseSerializer(serializers.Serializer[Any]):
    """The revise action takes no body."""


class DeliveryStatusChangeSerializer(serializers.ModelSerializer[DeliveryStatusChange]):
    """One row of a delivery's status history."""

    class Meta:
        model = DeliveryStatusChange
        fields = ("id", "from_status", "to_status", "actor", "reason", "override_kind", "at")
        read_only_fields = fields


class DeliveryQCCheckSerializer(serializers.ModelSerializer[DeliveryQCCheck]):
    """One check of a QC run."""

    item = serializers.UUIDField(source="item.uid", read_only=True, default=None)

    class Meta:
        model = DeliveryQCCheck
        fields = ("run_id", "item", "check_name", "outcome", "detail", "checked_by", "checked_at")
        read_only_fields = fields
