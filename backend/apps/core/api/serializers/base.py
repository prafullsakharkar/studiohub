"""Core API base serializers."""

from __future__ import annotations

from rest_framework import serializers


class BaseModelSerializer(serializers.ModelSerializer):
    """Base serializer for domain models."""

    class Meta:
        """Meta class for BaseModelSerializer."""

        abstract = True


# Backward-compatible aliases. Domain applications historically imported
# these names; keep them pointing at the same base class.
BaseSerializer = BaseModelSerializer


class BaseReadSerializer(BaseModelSerializer):
    """Base serializer for read operations."""


class BaseWriteSerializer(BaseModelSerializer):
    """Base serializer for write operations."""


class BaseNestedSerializer(BaseModelSerializer):
    """Base serializer for nested operations."""
