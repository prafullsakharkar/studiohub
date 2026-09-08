"""
Base choices used throughout the application.
"""

from __future__ import annotations

from django.db import models


class BaseChoices(models.TextChoices):
    """
    Base class for all TextChoices.
    """

    @classmethod
    def values(cls) -> list[str]:
        return [str(choice.value) for choice in cls]

    @classmethod
    def labels(cls) -> list[str]:
        return [str(choice.label) for choice in cls]

    @classmethod
    def choices_dict(cls) -> dict[str, str]:
        return {str(choice.value): str(choice.label) for choice in cls}
