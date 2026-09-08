"""Core API base serializers."""

from __future__ import annotations

from typing import TypeVar

from django.db import models
from rest_framework import serializers

_ModelT = TypeVar("_ModelT", bound=models.Model)


class BaseModelSerializer(serializers.ModelSerializer[_ModelT]):
    """Base serializer for domain models."""

    class Meta:
        """Meta class for BaseModelSerializer."""

        abstract = True


# Backward-compatible aliases. Domain applications historically imported
# these names; keep them pointing at the same base class.
BaseSerializer = BaseModelSerializer


class BaseReadSerializer(BaseModelSerializer[_ModelT]):
    """Base serializer for read operations."""


class BaseWriteSerializer(BaseModelSerializer[_ModelT]):
    """Base serializer for write operations."""


class BaseNestedSerializer(BaseModelSerializer[_ModelT]):
    """Base serializer for nested operations."""
