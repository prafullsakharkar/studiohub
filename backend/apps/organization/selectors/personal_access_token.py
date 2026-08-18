from __future__ import annotations

from django.db import models
from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import PersonalAccessToken


class PersonalAccessTokenSelector(BaseSelector):
    """
    Selector for PersonalAccessToken model.
    """

    model = PersonalAccessToken

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get personal access token queryset.
        """
        queryset = PersonalAccessToken.objects.all()

        if request and hasattr(request, "user"):
            # Users can see their own tokens
            if not request.user.is_superuser:
                queryset = queryset.filter(user=request.user)

        return queryset

    @classmethod
    def for_user(cls, user):
        """
        Filter by user.
        """
        return cls.get_queryset().filter(user=user)

    @classmethod
    def active(cls):
        """
        Return active tokens.
        """
        return cls.get_queryset().active()

    @classmethod
    def inactive(cls):
        """
        Return inactive tokens.
        """
        return cls.get_queryset().inactive()
