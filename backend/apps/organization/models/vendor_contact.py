from django.db import models

from apps.core.models.bases import EntityModel


class VendorContact(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="vendor_contacts",
        db_index=True,
    )
    vendor = models.ForeignKey(
        "organization.Vendor",
        on_delete=models.CASCADE,
        related_name="contacts",
        db_index=True,
    )
    name = models.CharField(max_length=255, db_index=True)
    role = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="", db_index=True)
    phone = models.CharField(max_length=50, blank=True, default="")
    timezone = models.CharField(max_length=100, blank=True, default="")
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "organization_vendor_contact"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["organization", "vendor"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.vendor})"
