"""
Attachment selectors.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.models.attachment import Attachment
from apps.core.selectors.base import BaseSelector


class AttachmentSelector(BaseSelector):
    """
    Selector for Attachment model.

    This selector provides domain-neutral access to attachments.
    Applications should override get_queryset to implement
    domain-specific filtering logic.
    """

    model = Attachment

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get queryset for Attachment.

        By default, returns all attachments. Applications should
        override this method to implement domain-specific filtering.
        """
        return cls.model.objects.all()
