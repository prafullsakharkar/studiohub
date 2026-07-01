"""
Validation mixin.
"""

from __future__ import annotations


class ValidationMixin:
    """
    Common validation helpers.
    """

    def perform_validation(
        self,
        serializer,
    ):
        serializer.is_valid(
            raise_exception=True,
        )

        return serializer
