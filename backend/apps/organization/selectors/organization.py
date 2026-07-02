"""
Organization selectors.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models import Organization


def organization_queryset() -> QuerySet[Organization]:
    """
    Base optimized queryset.
    """
    return Organization.objects.select_related(
        "created_by",
        "updated_by",
    )


def get_organization(pk) -> Organization:
    """
    Get organization by primary key.
    """
    return organization_queryset().get(pk=pk)


def get_organization_by_slug(slug: str) -> Organization:
    """
    Get organization by slug.
    """
    return organization_queryset().by_slug(slug).get()


def get_organization_by_code(code: str) -> Organization:
    """
    Get organization by code.
    """
    return organization_queryset().by_code(code).get()


def list_organizations():
    """
    List organizations.
    """
    return organization_queryset().ordered()


def list_active_organizations():
    """
    Active organizations.
    """
    return organization_queryset().active()


def organization_exists(code: str) -> bool:
    """
    Check whether organization exists.
    """
    return Organization.objects.by_code(code).exists()
