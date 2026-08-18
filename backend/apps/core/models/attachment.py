"""
Attachment model for file attachments.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from apps.core.choices.file import FileType
from apps.core.filesystem.storage import StorageService
from apps.core.models.bases.entity import EntityModel


def attachment_upload_path(instance: Attachment, filename: str) -> str:
    """
    Generate upload path for attachments.
    
    Format: attachments/{organization_id}/{year}/{month}/{uuid}_{filename}
    """
    
    # Get organization from instance if available
    org_id = "unknown"
    if hasattr(instance, "organization") and instance.organization:
        org_id = instance.organization.id
    
    # Generate unique filename
    ext = filename.split(".")[-1] if "." in filename else "dat"
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    
    # Create path with date-based organization
    now = timezone.now()
    return f"attachments/{org_id}/{now.year}/{now.month:02d}/{unique_filename}"


class Attachment(EntityModel):
    """
    Attachment model for storing file references and metadata.
    
    Attachments can be linked to any entity in the system and provide
    a way to store and retrieve files with metadata.
    """

    file = models.FileField(
        upload_to=attachment_upload_path,
        max_length=500,
        help_text="The actual file stored",
    )

    name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Display name of the attachment",
    )

    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of the attachment",
    )

    file_type = models.CharField(
        max_length=20,
        choices=[(tag.value, tag.name.replace("_", " ").title()) for tag in FileType],
        default=FileType.DOCUMENT.value,
        db_index=True,
        help_text="Type of file",
    )

    mime_type = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="MIME type of the file",
    )

    file_size = models.PositiveBigIntegerField(
        default=0,
        db_index=True,
        help_text="Size of the file in bytes",
    )

    storage_key = models.CharField(
        max_length=500,
        unique=True,
        db_index=True,
        help_text="Unique key for storage reference",
    )

    is_public = models.BooleanField(
        default=False,
        help_text="Whether this attachment can be accessed without authentication",
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="When this attachment should expire",
    )

    class Meta:
        db_table = "core_attachment"
        ordering = ["-created_at"]
        verbose_name = "Attachment"
        verbose_name_plural = "Attachments"
        

    def __str__(self) -> str:
        return self.name or f"Attachment {self.id}"

    @property
    def url(self) -> str:
        """Get the URL for this attachment."""
        return StorageService.get_file_url(self.storage_key)

    @property
    def filename(self) -> str:
        """Get the original filename."""
        return self.file.name.split("/")[-1] if self.file else ""

    @property
    def extension(self) -> str:
        """Get the file extension."""
        return self.filename.split(".")[-1].lower() if "." in self.filename else ""

    def delete(self, *args, **kwargs) -> tuple[int, dict[str, int]]:
        """Delete the attachment and the underlying file."""
        # Delete the file from storage
        if self.file and StorageService.exists(self.file.name):
            StorageService.delete(self.file.name)
        
        # Delete the database record
        return super().delete(*args, **kwargs)
