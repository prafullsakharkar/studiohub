"""
Person model.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import LifecycleModel, NamedEntityModel


class Person(LifecycleModel, NamedEntityModel):
    """
    Person entity representing a person (player, official, staff, etc.).

    This is a base model that can be extended by specific person types.

    ``organization`` is nullable for legacy rows: organization-scoped reads
    (fail-closed) only return rows belonging to the request organization,
    while staff/superusers remain unscoped. New rows created through the API
    default to the request organization (see PersonViewSet.perform_create).
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="organization_persons",
        null=True,
        blank=True,
        db_index=True,
    )

    email = models.EmailField(
        _("Email"),
        blank=True,
        db_index=True,
    )

    phone = models.CharField(
        _("Phone"),
        max_length=20,
        blank=True,
        db_index=True,
    )

    date_of_birth = models.DateField(
        _("Date of Birth"),
        null=True,
        blank=True,
    )

    nationality = models.CharField(
        _("Nationality"),
        max_length=100,
        blank=True,
    )

    class Meta:
        verbose_name = _("Person")
        verbose_name_plural = _("People")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["organization", "name"]),
        ]

    def __str__(self):
        return self.name
