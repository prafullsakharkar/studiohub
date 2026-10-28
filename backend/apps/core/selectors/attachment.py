"""
Attachment selectors.
"""

from __future__ import annotations

from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.core.models.attachment import Attachment
from apps.core.selectors.base import BaseSelector


class AttachmentSelector(BaseSelector):
    """
    Selector for Attachment model.

    An attachment has no project or tenant of its own, so access follows ownership: a caller sees
    the files they uploaded that have not expired. Superusers (break-glass) see every file.
    A read without a request is an internal read and is not narrowed.
    """

    model = Attachment

    @classmethod
    def for_user(cls, user) -> QuerySet[Attachment]:
        """Attachments ``user`` may see; none for anonymous or inactive callers."""
        queryset = cls.model.objects.all()

        if user is None or not getattr(user, "is_authenticated", False):
            return queryset.none()

        if not getattr(user, "is_active", True):
            return queryset.none()

        if getattr(user, "is_superuser", False):
            return queryset

        return queryset.filter(created_by=user).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        )

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet[Attachment]:
        """Attachments the request's user may see (all of them when there is no request)."""
        if request is None:
            return cls.model.objects.all()

        return cls.for_user(getattr(request, "user", None))
