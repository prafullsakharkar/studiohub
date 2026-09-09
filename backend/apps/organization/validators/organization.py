from __future__ import annotations

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator, validate_email

from apps.organization.models import Organization
from apps.organization.validators.base import (
    OrganizationBaseValidator,
)


class OrganizationValidator(OrganizationBaseValidator):
    """
    Validator for Organization.
    """

    model = Organization

    @classmethod
    def validate_code_unique(cls, code, instance=None):
        queryset = Organization.objects.filter(code=code)

        if instance:
            queryset = queryset.exclude(pk=instance.pk)

        if queryset.exists():
            raise ValidationError(
                "Organization with this code already exists."
            )

    @classmethod
    def validate_create(cls, **kwargs):
        code = kwargs.get("code")
        name = kwargs.get("name")

        if not code:
            raise ValidationError("Code is required.")

        if not name:
            raise ValidationError("Name is required.")

        if not kwargs.get("organization_type"):
            raise ValidationError("Organization type is required.")

        email = kwargs.get("email")
        if email:
            try:
                validate_email(email)
            except ValidationError:
                raise ValidationError(
                    "Enter a valid email address."
                ) from None

        website = kwargs.get("website")
        if website:
            try:
                URLValidator()(website)
            except ValidationError:
                raise ValidationError(
                    "Enter a valid URL."
                ) from None

        cls.validate_code_unique(code)

        return kwargs

    @classmethod
    def validate_update(cls, instance, **kwargs):
        code = kwargs.get("code")

        if code:
            cls.validate_code_unique(
                code,
                instance=instance,
            )

        return kwargs
