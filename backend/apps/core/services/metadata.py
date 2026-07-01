"""
Metadata service.
"""

from __future__ import annotations

from .base import BaseService


class MetadataService(BaseService):
    """
    Service for JSON metadata operations.
    """

    @classmethod
    def get(cls, instance, key, default=None):
        return instance.metadata.get(key, default)

    @classmethod
    def set(cls, instance, key, value):
        instance.metadata[key] = value

        instance.save(update_fields=["metadata"])

        return instance

    @classmethod
    def remove(cls, instance, key):
        instance.metadata.pop(key, None)

        instance.save(update_fields=["metadata"])

        return instance

    @classmethod
    def clear(cls, instance):
        instance.metadata = {}

        instance.save(update_fields=["metadata"])

        return instance
