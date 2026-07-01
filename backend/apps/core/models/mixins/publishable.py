"""
Publishable mixin.
"""

from __future__ import annotations

from apps.core.services import PublishableService


class PublishableMixin:
    """
    Publish helper methods.
    """

    def publish(self):
        return PublishableService.publish(self)

    def unpublish(self):
        return PublishableService.unpublish(self)
