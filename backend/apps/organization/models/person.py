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
    """

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

    def __str__(self):
        return self.name
