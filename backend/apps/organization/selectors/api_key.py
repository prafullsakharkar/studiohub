from __future__ import annotations

from django.db import models
from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import APIKey


class APIKeySelector(BaseSelector):
    """
    Selector for APIKey model.
    """

    model = APIKey

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get API key queryset.
        """
        queryset = APIKey.objects.all()

        # Users can see their own API keys and organization API keys
        if request and hasattr(request, "user") and not request.user.is_superuser:
            queryset = queryset.filter(
                models.Q(owner=request.user)
                | models.Q(organization__in=request.user.organizations.all())
            )

        return queryset

    @classmethod
    def for_organization(cls, organization):
        """
        Filter by organization.
        """
        return cls.get_queryset().filter(organization=organization)

    @classmethod
    def for_user(cls, user):
        """
        Filter by user (owner).
        """
        return cls.get_queryset().filter(owner=user)

    @classmethod
    def active(cls):
        """
        Return active API keys.
        """
        return cls.get_queryset().active()

    @classmethod
    def inactive(cls):
        """
        Return inactive API keys.
        """
        return cls.get_queryset().inactive()
