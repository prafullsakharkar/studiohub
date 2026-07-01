"""
Base service class.
"""

from __future__ import annotations

from typing import Generic, TypeVar

from django.db import models

ModelType = TypeVar("ModelType", bound=models.Model)


class BaseService(Generic[ModelType]):
    """
    Base class for reusable services.
    """

    @classmethod
    def save(
        cls,
        instance: ModelType,
        *,
        update_fields: list[str] | None = None,
    ) -> ModelType:
        """
        Save an instance.
        """
        instance.save(
            update_fields=update_fields,
        )
        return instance
