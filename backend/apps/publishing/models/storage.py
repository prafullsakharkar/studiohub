"""
Storage roots: the named places published files live under (CONTRACTS DOM-PUB-01).

StudioHub registers paths relative to a root and never stores or moves the bytes. The three
display paths are shown to people; whether the *server* can read a root (to verify checksums)
is configured in settings (``PUBLISHING_STORAGE_MOUNTS``), never in this table.
"""

from __future__ import annotations

from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Upper

from apps.core.models.bases.entity import EntityModel

ROOT_CODE_VALIDATOR = RegexValidator(
    r"^[A-Za-z][A-Za-z0-9_-]*$",
    "Use letters, digits, '_' or '-', starting with a letter.",
)


class StorageRoot(EntityModel):
    code = models.CharField(max_length=50, validators=[ROOT_CODE_VALIDATOR])
    name = models.CharField(max_length=255)
    linux_path = models.CharField(max_length=500, blank=True, default="")
    windows_path = models.CharField(max_length=500, blank=True, default="")
    mac_path = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "publishing_storage_root"
        ordering = ("code",)
        constraints = [
            # Over every row, soft-deleted included: files keep the code of their root forever.
            models.UniqueConstraint(Upper("code"), name="publishing_storage_root_ucode_uniq"),
        ]

    def __str__(self) -> str:
        return self.code
