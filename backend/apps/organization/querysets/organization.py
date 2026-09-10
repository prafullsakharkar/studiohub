"""
Organization queryset.
"""

from __future__ import annotations

from django.db.models import Count, Q

from apps.core.models.querysets.base import BaseQuerySet
from apps.core.models.querysets.mixins.lifecycle import (
    LifecycleQuerySetMixin,
)
from apps.core.models.querysets.mixins.ordering import (
    OrderingQuerySetMixin,
)
from apps.core.models.querysets.mixins.search import (
    SearchQuerySetMixin,
)
from apps.core.models.querysets.mixins.soft_delete import (
    SoftDeleteQuerySetMixin,
)


class OrganizationQuerySet(
    LifecycleQuerySetMixin,
    SearchQuerySetMixin,
    OrderingQuerySetMixin,
    SoftDeleteQuerySetMixin,
    BaseQuerySet,
):
    """
    QuerySet for Organization.
    """

    search_fields = (
        "name",
        "code",
        "email",
        "website",
        "description",
    )

    default_ordering = ("name",)

    def by_slug(self, slug: str):
        """
        Filter by slug.
        """
        return self.filter(slug=slug)

    def by_code(self, code: str):
        """
        Filter by organization code.
        """
        return self.filter(code=code)

    def by_country(self, country: str):
        """
        Filter by country.
        """
        return self.filter(country=country)

    def by_timezone(self, timezone: str):
        """
        Filter by timezone.
        """
        return self.filter(timezone=timezone)

    def with_member_count(self):
        """
        Annotate member count.
        """
        return self.annotate(
            member_count=Count(
                "memberships",
                distinct=True,
            )
        )

    def with_statistics(self):
        """
        Annotate computed statistics (members, departments, teams, offices).
        """
        return self.annotate(
            member_count=Count(
                "memberships",
                distinct=True,
            ),
            department_count=Count(
                "organization_departments",
                distinct=True,
            ),
            team_count=Count(
                "organization_teams",
                distinct=True,
            ),
            office_count=Count(
                "organization_offices",
                distinct=True,
            ),
        )

    def optimized_for_list(self):
        """
        Prefetch/annotate for the list serializer.

        Eliminates per-row fan-out in `OrganizationSerializer.get_*_count`
        (memberships, offices, active projects) and the billing lookup.
        """
        from django.db.models import Prefetch

        return self.with_statistics().select_related(
            "billing",
        ).prefetch_related(
            Prefetch(
                "production_projects",
                queryset=__import__(
                    "apps.production.models.project",
                    fromlist=["Project"],
                ).Project.objects.exclude(status="Archived"),
            ),
        )

    def lookup(self, value: str):
        """
        Lookup by name, code or slug.
        """
        return self.filter(
            Q(name__iexact=value) | Q(code__iexact=value) | Q(slug__iexact=value)
        )
