"""
Delivery Package model for client turnover.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models.functions import Upper
from django.utils import timezone

from apps.core.models.bases.entity import EntityModel
from apps.deliveries.constants import workflow as _wf
from apps.deliveries.models.counter import DeliveryCounter
from apps.deliveries.models.history import DeliveryStatusChange
from apps.deliveries.models.item_file import DeliveryItemFile, FrozenSnapshotError
from apps.deliveries.models.qc import DeliveryQCCheck


class DeliveryPackage(EntityModel):
    """
    Client delivery package for turnover.

    Represents a formal client turnover bundle containing
    multiple versions with QC validation and delivery tracking.
    """

    # Status choices
    STATUS_DRAFT = "Draft"
    STATUS_VALIDATING = "Validating"
    STATUS_PREPARED = "Prepared"
    STATUS_SIGNED_OFF = "Signed Off"
    STATUS_SUBMITTED = "Submitted"
    STATUS_APPROVED = "Approved"
    STATUS_REJECTED = "Rejected"
    STATUS_COMPLETE = "Complete"
    STATUS_CANCELLED = "Cancelled"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_VALIDATING, "Validating"),
        (STATUS_PREPARED, "Prepared"),
        (STATUS_SIGNED_OFF, "Signed Off"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_COMPLETE, "Complete"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    # Delivery methods
    METHOD_ASPERA = "Aspera"
    METHOD_S3 = "S3"
    METHOD_FTP = "FTP"
    METHOD_WEB = "Web Download"

    METHOD_CHOICES = [
        (METHOD_ASPERA, "Aspera"),
        (METHOD_S3, "S3"),
        (METHOD_FTP, "FTP"),
        (METHOD_WEB, "Web Download"),
    ]

    # Client-facing status
    CLIENT_STATUS_PENDING = "Pending"
    CLIENT_STATUS_IN_REVIEW = "In Review"
    CLIENT_STATUS_APPROVED = "Approved"
    CLIENT_STATUS_REJECTED = "Rejected"

    CLIENT_STATUS_CHOICES = [
        (CLIENT_STATUS_PENDING, "Pending"),
        (CLIENT_STATUS_IN_REVIEW, "In Review"),
        (CLIENT_STATUS_APPROVED, "Approved"),
        (CLIENT_STATUS_REJECTED, "Rejected"),
    ]

    name = models.CharField(
        max_length=255,
        help_text="Delivery package name",
    )

    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique delivery code",
    )

    project = models.ForeignKey(
        "production.Project",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="delivery_packages",
        db_index=True,
        help_text="Associated project",
    )

    client = models.ForeignKey(
        "masterdata.Client",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="delivery_packages",
        db_index=True,
        help_text="Client recipient",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
        help_text="Delivery package status",
    )

    client_status = models.CharField(
        max_length=20,
        choices=CLIENT_STATUS_CHOICES,
        default=CLIENT_STATUS_PENDING,
        db_index=True,
        help_text="Client-facing status",
    )

    delivery_method = models.CharField(
        max_length=20,
        choices=METHOD_CHOICES,
        default=METHOD_S3,
        help_text="Delivery method",
    )

    destination = models.ForeignKey(
        "deliveries.DeliveryDestination",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="packages",
        help_text="Where the delivery goes (replaces the free-text destination)",
    )

    delivery_destination = models.TextField(
        blank=True,
        help_text=(
            "Deprecated free text. Used only while no destination is chosen; with a destination "
            "the API shows the destination's own address."
        ),
    )

    passcode = models.CharField(
        max_length=255,
        blank=True,
        help_text=(
            "Security passcode for client access, stored encrypted (apps.deliveries.passcode). "
            "Never read this column directly."
        ),
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="When this delivery expires",
    )

    total_size_bytes = models.PositiveBigIntegerField(
        default=0,
        help_text="Total size of all versions in bytes",
    )

    total_frames = models.PositiveIntegerField(
        default=0,
        help_text="Total frames across all versions",
    )

    notes = models.TextField(
        blank=True,
        help_text="Internal notes about this delivery",
    )

    client_notes = models.TextField(
        blank=True,
        help_text="Notes visible to client",
    )

    manifest_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Delivery manifest data (EDL, XML, etc.)",
    )

    checksums = models.JSONField(
        default=dict,
        blank=True,
        help_text="File checksums (MD5, SHA256)",
    )

    is_archived = models.BooleanField(
        default=False,
        help_text="Whether this delivery is archived",
    )

    # -- what was sent (set once, by the send) ------------------------------------------
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="Who sent the delivery",
    )

    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the delivery was sent (the real time, not the last edit)",
    )

    transfer_reference = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Id of the transfer outside StudioHub (Aspera job, ticket), typed by the sender",
    )

    qc_run_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="The latest QC run of this delivery (rows in DeliveryQCCheck)",
    )

    # -- internal approval, the client's answer, the reasons ---------------------------
    signed_off_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="Who signed the delivery off (internal approval)",
    )

    signed_off_at = models.DateTimeField(null=True, blank=True)

    client_answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="Who recorded the client's answer",
    )

    client_answered_at = models.DateTimeField(null=True, blank=True)

    cancellation_reason = models.CharField(max_length=500, blank=True, default="")

    rejection_reason = models.CharField(max_length=500, blank=True, default="")

    revision_of = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="revisions",
        help_text="The rejected delivery this one re-delivers",
    )

    class Meta:
        db_table = "deliveries_package"
        ordering = ("-created_at",)
        verbose_name = "Delivery Package"
        verbose_name_plural = "Delivery Packages"
        constraints = [
            # Any case, every row (deleted ones keep their code); the server numbers new
            # deliveries and a code that is sent is checked against this.
            models.UniqueConstraint(Upper("code"), name="deliveries_package_ucode_uniq"),
        ]

    def __str__(self):
        return f"{self.code}: {self.name}"

    @property
    def version_count(self):
        """Get the number of versions in this delivery."""
        return self.versions.count()

    @property
    def is_expired(self):
        """Check if this delivery has expired."""
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at


class DeliveryVersionRef(models.Model):
    """
    Reference to a version in a delivery package.
    """

    delivery = models.ForeignKey(
        DeliveryPackage,
        on_delete=models.PROTECT,
        related_name="versions",
        db_index=True,
        help_text="Delivery package",
    )

    version = models.ForeignKey(
        "production.Version",
        on_delete=models.PROTECT,
        related_name="delivery_references",
        db_index=True,
        help_text="Version being delivered",
    )

    uid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text="Id the API uses for this item (the integer pk is kept for older clients)",
    )

    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="Who added this item",
    )

    version_number = models.CharField(
        max_length=50,
        help_text="Version number at time of delivery",
    )

    entity_type = models.CharField(
        max_length=50,
        help_text="Entity type (Shot, Asset)",
    )

    entity_code = models.CharField(
        max_length=255,
        help_text="Entity code",
    )

    entity_name = models.CharField(
        max_length=255,
        help_text="Entity display name",
    )

    file_size_bytes = models.PositiveBigIntegerField(
        default=0,
        help_text="File size in bytes",
    )

    frame_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of frames",
    )

    file_path = models.CharField(
        max_length=500,
        help_text="File path or URL",
    )

    checksum_md5 = models.CharField(
        max_length=32,
        blank=True,
        help_text="MD5 checksum",
    )

    checksum_sha256 = models.CharField(
        max_length=64,
        blank=True,
        help_text="SHA256 checksum",
    )

    is_validated = models.BooleanField(
        default=False,
        help_text="Whether this version has passed QC validation",
    )

    validation_notes = models.TextField(
        blank=True,
        help_text="QC validation notes",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this reference was added",
    )

    class Meta:
        db_table = "deliveries_version_ref"
        ordering = ("version_number",)
        verbose_name = "Delivery Version Reference"
        verbose_name_plural = "Delivery Version References"
        unique_together = ("delivery", "version")

    def __str__(self):
        return f"{self.delivery.code} - {self.version_number}"

    def save(self, *args, **kwargs):
        """An item of a delivery that has been sent never changes."""
        if not self._state.adding and not self._delivery_can_change():
            raise FrozenSnapshotError("This item belongs to a delivery that was sent.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if not self._delivery_can_change():
            raise FrozenSnapshotError("This item belongs to a delivery that was sent.")
        return super().delete(*args, **kwargs)

    def _delivery_can_change(self) -> bool:
        package = self.delivery
        return package.status in _wf.WORKING_STATES and package.sent_at is None


class DeliveryDestination(EntityModel):
    """
    Delivery destination for client turnover routing.

    Static reference data curated platform-wide (Aspera endpoints,
    S3 buckets, SFTP servers, archives). Presented as dropdown options
    in delivery creation flows. Credentials themselves are never stored
    here — only a flag indicating they are configured elsewhere.
    """

    TYPE_ASPERA = "Aspera Connect"
    TYPE_SIGNIANT = "Signiant Media Shuttle"
    TYPE_S3 = "AWS S3 Bucket"
    TYPE_FRAMEIO = "Frame.io Enterprise"
    TYPE_LTO = "LTO Tape Archive"
    TYPE_SFTP = "Client SFTP"
    TYPE_HDD = "Hard Drive Ingest"

    TYPE_CHOICES = [
        (TYPE_ASPERA, "Aspera Connect"),
        (TYPE_SIGNIANT, "Signiant Media Shuttle"),
        (TYPE_S3, "AWS S3 Bucket"),
        (TYPE_FRAMEIO, "Frame.io Enterprise"),
        (TYPE_LTO, "LTO Tape Archive"),
        (TYPE_SFTP, "Client SFTP"),
        (TYPE_HDD, "Hard Drive Ingest"),
    ]

    name = models.CharField(
        max_length=255,
        help_text="Display name",
    )

    destination_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        db_index=True,
        help_text="Destination type",
    )

    endpoint = models.CharField(
        max_length=500,
        help_text="Endpoint address, URL, or bucket",
    )

    credentials_configured = models.BooleanField(
        default=False,
        help_text="Whether transfer credentials are configured",
    )

    transfer_rate_mbps = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Expected transfer rate in Mbps",
    )

    storage_region = models.CharField(
        max_length=255,
        blank=True,
        help_text="Storage region description",
    )

    port = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Connection port, if applicable",
    )

    target_directory = models.CharField(
        max_length=500,
        blank=True,
        help_text="Target directory on the remote end",
    )

    is_default = models.BooleanField(
        default=False,
        help_text="Default destination for new deliveries",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Whether this destination is available",
    )

    class Meta:
        db_table = "deliveries_destination"
        ordering = ("name",)
        verbose_name = "Delivery Destination"
        verbose_name_plural = "Delivery Destinations"
        constraints = [
            # Any case, among live destinations; at most one live default.
            models.UniqueConstraint(
                Upper("name"),
                condition=models.Q(is_deleted=False),
                name="deliveries_dest_uname_live_uniq",
            ),
            models.UniqueConstraint(
                fields=["is_default"],
                condition=models.Q(is_default=True, is_deleted=False),
                name="deliveries_dest_one_default",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.destination_type})"


__all__ = [
    "DeliveryCounter",
    "DeliveryDestination",
    "DeliveryItemFile",
    "DeliveryPackage",
    "DeliveryQCCheck",
    "DeliveryStatusChange",
    "DeliveryVersionRef",
]
