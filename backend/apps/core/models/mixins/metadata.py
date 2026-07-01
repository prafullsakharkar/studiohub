"""
Metadata mixin.
"""

from __future__ import annotations

from apps.core.services import MetadataService


class MetadataMixin:
    """
    Metadata helper methods.
    """

    def get_meta(self, key, default=None):
        return MetadataService.get(
            self,
            key,
            default,
        )

    def set_meta(self, key, value):
        return MetadataService.set(
            self,
            key,
            value,
        )

    def remove_meta(self, key):
        return MetadataService.remove(
            self,
            key,
        )

    def clear_meta(self):
        return MetadataService.clear(self)
