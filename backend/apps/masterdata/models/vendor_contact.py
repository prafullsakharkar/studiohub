"""
Global vendor contact model (org-removal B3).

Contact person for a platform-global vendor. No organization FK. Personal data:
see ``ContactBase``.
"""

from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower

from apps.masterdata.models.contact import ContactBase


class VendorContact(ContactBase):
    vendor = models.ForeignKey(
        "masterdata.Vendor",
        on_delete=models.PROTECT,
        related_name="contacts",
        db_index=True,
    )

    class Meta(ContactBase.Meta):
        db_table = "masterdata_vendor_contact"
        indexes = [
            models.Index(fields=["vendor"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["vendor"],
                condition=models.Q(is_primary=True, is_deleted=False),
                name="masterdata_vendorcontact_one_primary",
            ),
            models.UniqueConstraint(
                models.F("vendor"),
                Lower("email"),
                condition=models.Q(is_deleted=False) & ~models.Q(email=""),
                name="masterdata_vendorcontact_uq_email_ci",
            ),
        ]

    def __str__(self):
        return f"Contact {self.pk} ({self.vendor_id})"  # pyright: ignore[reportAttributeAccessIssue]
