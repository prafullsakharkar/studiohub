from django.db import models

from apps.core.models.bases import EntityModel


class ClientContact(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="client_contacts",
        db_index=True,
    )
    client = models.ForeignKey(
        "organization.Client",
        on_delete=models.CASCADE,
        related_name="contacts",
        db_index=True,
    )
    name = models.CharField(max_length=255, db_index=True)
    role = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="", db_index=True)
    phone = models.CharField(max_length=50, blank=True, default="")
    timezone = models.CharField(max_length=100, blank=True, default="")
    portal_access = models.BooleanField(default=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "organization_client_contact"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["organization", "client"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.client})"
