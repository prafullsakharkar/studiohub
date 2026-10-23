"""
Global client contact model.

Contact person for a platform-global client. No organization FK. Personal data:
see ``ContactBase``.
"""

from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower

from apps.masterdata.models.contact import ContactBase


class ClientContact(ContactBase):
    # PROTECT: a client with contact rows cannot be hard-deleted; a soft delete
    # of the client soft-deletes its contacts in the service.
    client = models.ForeignKey(
        "masterdata.Client",
        on_delete=models.PROTECT,
        related_name="contacts",
        db_index=True,
    )
    portal_access = models.BooleanField(default=True)

    class Meta(ContactBase.Meta):
        db_table = "masterdata_client_contact"
        indexes = [
            models.Index(fields=["client"]),
        ]
        constraints = [
            # One primary contact per client (DOM-MD-CON-01).
            models.UniqueConstraint(
                fields=["client"],
                condition=models.Q(is_primary=True, is_deleted=False),
                name="masterdata_clientcontact_one_primary",
            ),
            # A contact e-mail is unique per client, ignoring case (DOM-MD-CON-04).
            models.UniqueConstraint(
                models.F("client"),
                Lower("email"),
                condition=models.Q(is_deleted=False) & ~models.Q(email=""),
                name="masterdata_clientcontact_uq_email_ci",
            ),
        ]

    def __str__(self):
        # The contact's name is personal data: identify the row by its client only.
        return f"Contact {self.pk} ({self.client_id})"  # pyright: ignore[reportAttributeAccessIssue]
