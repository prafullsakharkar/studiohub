"""
Organization model.
"""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.i18n.constants import (
    DEFAULT_COUNTRY,
    DEFAULT_CURRENCY,
    DEFAULT_LANGUAGE,
    DEFAULT_TIMEZONE,
)
from apps.core.i18n.countries import COUNTRIES
from apps.core.i18n.currencies import CURRENCIES
from apps.core.i18n.languages import LANGUAGES
from apps.core.i18n.timezones import TIMEZONES
from apps.core.models.bases.branding import BrandingModel
from apps.core.models.bases.lifecycle import LifecycleModel
from apps.core.models.bases.named import NamedEntityModel
from apps.core.validators.country import validate_country
from apps.core.validators.currency import validate_currency
from apps.core.validators.language import validate_language
from apps.core.validators.timezone import validate_timezone
from apps.organization.choices import OrganizationType
from apps.organization.constants import MAX_CODE_LENGTH, MAX_NAME_LENGTH
from apps.organization.managers import OrganizationManager


class Organization(
    BrandingModel,
    LifecycleModel,
    NamedEntityModel,
):
    """
    Root tenant of the platform.

    Every project, department, office, membership,
    asset and production entity belongs to an Organization.
    """

    code = models.CharField(
        _("Code"),
        max_length=MAX_CODE_LENGTH,
        unique=True,
        db_index=True,
        help_text=_("Unique organization code."),
    )

    slug = models.SlugField(
        _("Slug"),
        max_length=MAX_NAME_LENGTH,
        unique=True,
        db_index=True,
        help_text=_("URL-friendly organization identifier."),
    )

    organization_type = models.CharField(
        _("Organization Type"),
        max_length=32,
        choices=OrganizationType.choices,
        default=OrganizationType.STUDIO,
        db_index=True,
    )

    email = models.EmailField(
        _("Email"),
        blank=True,
    )

    phone = models.CharField(
        _("Phone"),
        max_length=32,
        blank=True,
    )

    website = models.URLField(
        _("Website"),
        blank=True,
    )

    country = models.CharField(
        _("Country"),
        max_length=2,
        choices=COUNTRIES,
        default=DEFAULT_COUNTRY,
        validators=[validate_country],
    )

    language = models.CharField(
        _("Language"),
        max_length=2,
        choices=LANGUAGES,
        default=DEFAULT_LANGUAGE,
        validators=[validate_language],
    )

    currency = models.CharField(
        _("Currency"),
        max_length=3,
        choices=CURRENCIES,
        default=DEFAULT_CURRENCY,
        validators=[validate_currency],
    )

    timezone = models.CharField(
        _("Timezone"),
        max_length=64,
        choices=TIMEZONES,
        default=DEFAULT_TIMEZONE,
        validators=[validate_timezone],
    )

    objects = OrganizationManager()

    class Meta:
        db_table = "organizations"

        verbose_name = _("Organization")
        verbose_name_plural = _("Organizations")

        ordering = ("name",)

        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["status"]),
            models.Index(fields=["organization_type"]),
            models.Index(fields=["country"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                name="uq_organization_code",
            ),
            models.UniqueConstraint(
                fields=["slug"],
                name="uq_organization_slug",
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def natural_key(self):
        """
        Used by Django serialization.
        """
        return (self.code,)

    @property
    def display_name(self) -> str:
        """
        Display-friendly organization name.
        """
        return f"{self.name} ({self.code})"
