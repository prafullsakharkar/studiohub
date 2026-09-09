from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.core.exceptions.base import DuplicateException
from apps.organization.models import ClientContract
from apps.organization.validators.base import (
    OrganizationBaseValidator,
)


class ClientContractValidator(OrganizationBaseValidator):
    """
    Validator for ClientContract.
    """

    model = ClientContract

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
    def _validate_number_unique(cls, organization, client, contract_number, instance=None):
        if not (organization and client and contract_number):
            return
        queryset = ClientContract.objects.filter(
            organization=organization,
            client=client,
            contract_number=contract_number,
        )
        if instance is not None:
            queryset = queryset.exclude(pk=instance.pk)
        if queryset.exists():
            raise DuplicateException(
                model_name="Client contract",
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
            kwargs.get("client"),
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
                instance.client,
                kwargs.get("contract_number"),
                instance=instance,
            )
