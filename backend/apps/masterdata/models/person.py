"""
Global person directory model (org-removal B3).

Platform-global person record with an optional link to the auth identity
(``identity.User``) plus department/team/office membership. No organization
FK. ``user`` keeps a distinct reverse accessor (``directory_person_profiles``)
so it never clashes with the legacy organization-scoped person model.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import LifecycleModel, NamedEntityModel, PlatformScopedModel


class Person(PlatformScopedModel, LifecycleModel, NamedEntityModel):
    """Person entity in the platform directory."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="directory_person_profiles",
        null=True,
        blank=True,
        db_index=True,
        help_text="Linked auth identity.",
    )

    role = models.ForeignKey(
        "masterdata.Position",
        on_delete=models.SET_NULL,
        related_name="persons",
        null=True,
        blank=True,
        db_index=True,
    )

    department = models.ForeignKey(
        "masterdata.Department",
        on_delete=models.SET_NULL,
        related_name="persons",
        null=True,
        blank=True,
        db_index=True,
    )

    team = models.ForeignKey(
        "masterdata.Team",
        on_delete=models.SET_NULL,
        related_name="persons",
        null=True,
        blank=True,
        db_index=True,
    )

    office = models.ForeignKey(
        "masterdata.Office",
        on_delete=models.SET_NULL,
        related_name="persons",
        null=True,
        blank=True,
        db_index=True,
    )

    seniority = models.CharField(max_length=32, blank=True, default="")

    skills = models.JSONField(default=list, blank=True)

    timezone = models.CharField(max_length=100, blank=True, default="")

    security_clearance = models.CharField(max_length=64, blank=True, default="")

    availability_status = models.CharField(max_length=32, blank=True, default="")

    email = models.EmailField(
        _("Email"),
        blank=True,
        default="",
        db_index=True,
    )

    phone = models.CharField(
        _("Phone"),
        max_length=20,
        blank=True,
        default="",
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
        default="",
    )

    class Meta:
        verbose_name = _("Person")
        verbose_name_plural = _("People")
        db_table = "masterdata_person"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                name="uq_masterdata_person_user",
            )
        ]

    def __str__(self):
        return self.name
