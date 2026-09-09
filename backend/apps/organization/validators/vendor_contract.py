from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.core.exceptions.base import DuplicateException
from apps.organization.models import VendorContract
from apps.organization.validators.base import (
    OrganizationBaseValidator,
)


class VendorContractValidator(OrganizationBaseValidator):
    """
    Validator for VendorContract.
    """

    model = VendorContract

    @classmethod
    def _validate_dates(cls, effective_date, expiry_date):
        if (
            effective_date
            and expiry_date
            and expiry_date < effective_date
        ):
            raise ValidationError(
                "Expiry date cannot be earlier than the effective date."
            )

    @classmethod
    def _validate_number_unique(cls, organization, vendor, contract_number, instance=None):
        if not (organization and vendor and contract_number):
            return
        queryset = VendorContract.objects.filter(
            organization=organization,
            vendor=vendor,
            contract_number=contract_number,
        )
        if instance is not None:
            queryset = queryset.exclude(pk=instance.pk)
        if queryset.exists():
            raise DuplicateException(
                model_name="Vendor contract",
                field="contract_number",
                value=contract_number,
            )

    @classmethod
    def validate_create(cls, **kwargs):
        cls._validate_dates(
            kwargs.get("effective_date"),
            kwargs.get("expiry_date"),
        )
        cls._validate_number_unique(
            kwargs.get("organization"),
            kwargs.get("vendor"),
            kwargs.get("contract_number"),
        )

    @classmethod
    def validate_update(cls, instance, **kwargs):
        effective_date = kwargs.get("effective_date", instance.effective_date)
        expiry_date = kwargs.get("expiry_date", instance.expiry_date)
        cls._validate_dates(effective_date, expiry_date)
        if "contract_number" in kwargs:
            cls._validate_number_unique(
                instance.organization,
                instance.vendor,
                kwargs.get("contract_number"),
                instance=instance,
            )
