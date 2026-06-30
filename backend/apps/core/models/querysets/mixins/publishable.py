"""
Publishable queryset mixin.
"""

from __future__ import annotations

from django.utils import timezone


class PublishableQuerySetMixin:
    """
    QuerySet helpers for publishable models.
    """

    def published(self):
        """
        Return published objects.
        """
        now = timezone.now()

        return self.filter(
            is_published=True,
            published_at__lte=now,
        )

    def unpublished(self):
        """
        Return unpublished objects.
        """
        return self.filter(is_published=False)

    def scheduled(self):
        """
        Return objects scheduled for future publication.
        """
        return self.filter(
            is_published=True,
            published_at__gt=timezone.now(),
        )
