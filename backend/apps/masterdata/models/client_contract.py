"""
Global client contract model.

Contract for a platform-global client. No organization FK. See ``ContractBase``
for the status model (``Expired`` is derived) and docs/masterdata/DECISIONS.md D8
for the overlap rule (Active MSAs, per client, inclusive end date, null end =
open-ended).
"""

from __future__ import annotations

from django.contrib.postgres.fields import DateRangeField, RangeOperators
from django.db import models
from django.db.models import Func, Value
from django.db.models.functions import Lower

from apps.masterdata.constraints import PostgresOnlyExclusionConstraint
from apps.masterdata.models.contract import EXCLUSIVE_TYPE, ContractBase, ContractStatus


class ClientContract(ContractBase):
    # PROTECT: a client with contract rows cannot be hard-deleted.
    client = models.ForeignKey(
        "masterdata.Client",
        on_delete=models.PROTECT,
        related_name="contracts",
        db_index=True,
    )
    type = models.CharField(max_length=30, default="SOW", db_index=True)
    # Whole units of ``currency`` as an integer: DRF renders Decimal as a string,
    # but the frontend contract declares this as a number (arithmetic/display).
    value_usd = models.PositiveBigIntegerField(default=0)
    document_url = models.URLField(max_length=500, blank=True, default="")

    class Meta(ContractBase.Meta):
        db_table = "masterdata_client_contract"
        indexes = [
            models.Index(fields=["client"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                models.F("client"),
                Lower("contract_number"),
                condition=models.Q(is_deleted=False),
                name="masterdata_clientcontract_uq_number_ci",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=ContractStatus.values),
                name="masterdata_clientcontract_status_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(expiry_date__isnull=True)
                    | models.Q(effective_date__isnull=True)
                    | models.Q(expiry_date__gte=models.F("effective_date"))
                ),
                name="masterdata_clientcontract_expiry_after_effective",
            ),
            # A contract that is or was Active has a start, so its range has a lower bound.
            models.CheckConstraint(
                condition=models.Q(effective_date__isnull=False)
                | (~models.Q(status=ContractStatus.ACTIVE) & models.Q(activated_at__isnull=True)),
                name="masterdata_clientcontract_active_has_start",
            ),
            # No two MSAs of one client overlap (DECISIONS D8): stored Active, or Terminated
            # after having been Active (it keeps the range it covered). The range is
            # inclusive at both ends; a null expiry is open-ended. PostgreSQL only.
            PostgresOnlyExclusionConstraint(
                name="masterdata_clientcontract_no_overlapping_active_msa",
                expressions=[
                    (models.F("client"), RangeOperators.EQUAL),
                    (
                        Func(
                            models.F("effective_date"),
                            models.F("expiry_date"),
                            Value("[]"),
                            function="daterange",
                            output_field=DateRangeField(),
                        ),
                        RangeOperators.OVERLAPS,
                    ),
                ],
                condition=models.Q(type__iexact=EXCLUSIVE_TYPE, is_deleted=False)
                & (
                    models.Q(status=ContractStatus.ACTIVE)
                    | models.Q(status=ContractStatus.TERMINATED, activated_at__isnull=False)
                ),
            ),
        ]

    def __str__(self):
        return f"{self.contract_number} ({self.client})"
