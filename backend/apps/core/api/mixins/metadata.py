"""
Metadata mixin.
"""

from __future__ import annotations


class MetadataMixin:
    """
    Serializer metadata helper.
    """

    def get_metadata(
        self,
        instance,
    ):
        return getattr(
            instance,
            "metadata",
            {},
        )
