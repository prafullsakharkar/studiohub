"""
Shared fields and lifecycle of a client or vendor contract (DOM-MD-CTR).

Stored statuses are ``Draft``, ``Active`` and ``Terminated``. ``Expired`` is
**derived**: a stored-``Active`` contract whose ``expiry_date`` is before today
is reported as ``Expired``; nothing ever writes it (docs/masterdata/DECISIONS.md).
"""

from __future__ import annotations

from datetime import date

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import PlatformScopedModel

EXPIRED = "Expired"
#: The only type whose Active contracts may not overlap (D8).
EXCLUSIVE_TYPE = "MSA"


class ContractStatus(models.TextChoices):
    """Stored statuses. ``Expired`` is derived and deliberately absent."""

    DRAFT = "Draft", _("Draft")
    ACTIVE = "Active", _("Active")
    TERMINATED = "Terminated", _("Terminated")


class ContractBase(PlatformScopedModel):
    contract_number = models.CharField(max_length=100, db_index=True)
    title = models.CharField(max_length=255)
    effective_date = models.DateField(null=True, blank=True, default=None)
    expiry_date = models.DateField(null=True, blank=True, default=None)
    status = models.CharField(
        max_length=30,
        choices=ContractStatus.choices,
        default=ContractStatus.ACTIVE,
        db_index=True,
    )
    nda_signed = models.BooleanField(default=False)
    # ISO 4217. The amount fields keep their ``*_usd`` names (frontend contract)
    # but are amounts in this currency.
    currency = models.CharField(max_length=3, default="USD")
    # Set when the contract becomes Active. Separates "terminated after being
    # active" (its covered range stays occupied) from "terminated as a draft".
    activated_at = models.DateTimeField(null=True, blank=True, default=None, editable=False)

    class Meta:
        abstract = True
        ordering = ("contract_number",)

    def effective_status(self, today: date | None = None) -> str:
        """Status as reported by the API: ``Expired`` is derived from the end date."""
        elapsed = self.expiry_date is not None and self.expiry_date < (
            today or timezone.localdate()
        )
        if self.status == ContractStatus.ACTIVE and elapsed:
            return EXPIRED
        return self.status


def active_now_q(today: date) -> models.Q:
    """Rows whose API status is ``Active``: stored Active and not past their end date."""
    return models.Q(status=ContractStatus.ACTIVE) & (
        models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gte=today)
    )


def elapsed_q(today: date) -> models.Q:
    """Rows whose API status is ``Expired`` (derived): stored Active, end date past."""
    return models.Q(status=ContractStatus.ACTIVE, expiry_date__lt=today)
