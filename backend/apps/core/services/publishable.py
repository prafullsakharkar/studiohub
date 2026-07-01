"""
Publishable service.
"""

from __future__ import annotations

from django.utils import timezone

from .base import BaseService


class PublishableService(BaseService):
    """
    Service for publishable models.
    """

    @classmethod
    def publish(cls, instance):
        instance.is_published = True
        instance.published_at = timezone.now()

        instance.save(
            update_fields=[
                "is_published",
                "published_at",
            ]
        )

        return instance

    @classmethod
    def unpublish(cls, instance):
        instance.is_published = False

        instance.save(update_fields=["is_published"])

        return instance
