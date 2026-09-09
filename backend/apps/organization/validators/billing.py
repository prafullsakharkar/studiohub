from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.organization.models import OrganizationBilling
from apps.organization.validators.base import (
    OrganizationBaseValidator,
)


class OrganizationBillingValidator(OrganizationBaseValidator):
    """
    Validator for OrganizationBilling.
    """

    model = OrganizationBilling

    @classmethod
    def _validate_usage(cls, **kwargs):
        total = kwargs.get("farm_credits_total")
        used = kwargs.get("farm_credits_used")
        if total is not None and used is not None and used > total:
            raise ValidationError(
                "Farm credits used cannot exceed the total credits."
            )
        quota = kwargs.get("storage_quota_tb")
        used_tb = kwargs.get("storage_used_tb")
        if quota is not None and used_tb is not None and used_tb > quota:
            raise ValidationError(
                "Storage used cannot exceed the storage quota."
            )
        active = kwargs.get("active_seats_count")
        maximum = kwargs.get("max_seats_count")
        if active is not None and maximum is not None and active > maximum:
            raise ValidationError(
                "Active seats cannot exceed the maximum seats."
            )

    @classmethod
    def validate_update(cls, instance, **kwargs):
        merged = {
            "farm_credits_total": instance.farm_credits_total,
            "farm_credits_used": instance.farm_credits_used,
            "storage_quota_tb": instance.storage_quota_tb,
            "storage_used_tb": instance.storage_used_tb,
            "active_seats_count": instance.active_seats_count,
            "max_seats_count": instance.max_seats_count,
        }
        merged.update(kwargs)
        cls._validate_usage(**merged)
