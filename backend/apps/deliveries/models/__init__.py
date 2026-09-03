"""
Delivery Package model for client turnover.
"""
from __future__ import annotations

from django.db import models
from django.utils import timezone

from apps.core.models.bases.entity import EntityModel
from apps.organization.models.organization import Organization


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
    STATUS_SUBMITTED = "Submitted"
    STATUS_APPROVED = "Approved"
    STATUS_REJECTED = "Rejected"
    STATUS_COMPLETE = "Complete"
    STATUS_CANCELLED = "Cancelled"
    
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_VALIDATING, "Validating"),
        (STATUS_PREPARED, "Prepared"),
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
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="delivery_packages",
        db_index=True,
        help_text="Organization context",
    )
    
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="delivery_packages",
        db_index=True,
        help_text="Associated project",
    )
    
    client = models.ForeignKey(
        "organization.Client",
        on_delete=models.SET_NULL,
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
    
    delivery_destination = models.TextField(
        blank=True,
        help_text="Delivery destination (URL, path, etc.)",
    )
    
    passcode = models.CharField(
        max_length=64,
        blank=True,
        help_text="Security passcode for client access",
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
    
    class Meta:
        db_table = "deliveries_package"
        ordering = ("-created_at",)
        verbose_name = "Delivery Package"
        verbose_name_plural = "Delivery Packages"
    
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
        on_delete=models.CASCADE,
        related_name="versions",
        db_index=True,
        help_text="Delivery package",
    )
    
    version = models.ForeignKey(
        "production.Version",
        on_delete=models.CASCADE,
        related_name="delivery_references",
        db_index=True,
        help_text="Version being delivered",
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
