"""
Base validator classes.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from django.core.exceptions import ValidationError


class BaseValidator:
    """
    Base validator interface.
    """

    message = "Validation failed."

    code = "invalid"

    def __call__(self, value: Any):
        self.validate(value)

    def validate(self, value: Any):
        raise NotImplementedError

    @classmethod
    def validate_required_fields(
        cls,
        data: dict[str, Any],
        fields: Sequence[str],
    ) -> None:
        """
        Ensure required fields are present in the data.

        Args:
            data: Input data
            fields: Required field names

        Raises:
            ValidationError: If any required field is missing
        """
        missing = [field for field in fields if not data.get(field)]
        if missing:
            raise ValidationError(
                f"Missing required fields: {', '.join(missing)}"
            )

    @classmethod
    def exists(cls, model, **filters) -> bool:
        """
        Check whether a record matching the filters exists.
        """
        return model.objects.filter(**filters).exists()

    @classmethod
    def validate_choices(
        cls,
        value: Any,
        choices: Sequence[Any],
        field: str = "value",
    ) -> None:
        """
        Ensure a value is one of the allowed choices.

        Args:
            value: Value to validate
            choices: Allowed choices
            field: Field name (for error messages)

        Raises:
            ValidationError: If value is not in choices
        """
        if value not in choices:
            raise ValidationError(
                f"Invalid {field}: {value}. Must be one of: {', '.join(map(str, choices))}"
            )

    @classmethod
    def validate_date_range(
        cls,
        start_date: Any,
        end_date: Any,
    ) -> bool:
        """
        Check whether an end date is on or after a start date.

        Args:
            start_date: Start date/datetime
            end_date: End date/datetime

        Returns:
            True if the range is valid, False otherwise
        """
        if start_date is None or end_date is None:
            return False
        return end_date >= start_date
