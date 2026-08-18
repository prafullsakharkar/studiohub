"""
Organization analytics service.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from django.db.models import Count, Q
from django.utils import timezone

from apps.organization.models import (
    Department,
    Office,
    Organization,
    Position,
    Team,
)

if TYPE_CHECKING:
    from django.db.models import QuerySet


class OrganizationAnalyticsService:
    """
    Service for organization analytics and reporting.
    """

    @classmethod
    def get_organization_stats(
        cls,
        organization: Organization,
    ) -> dict:
        """
        Get organization statistics.

        Args:
            organization: The organization to get stats for

        Returns:
            Dictionary with organization statistics
        """
        return {
            "organization": {
                "id": str(organization.id),
                "code": organization.code,
                "name": organization.name,
            },
            "departments": cls.get_department_stats(organization),
            "offices": cls.get_office_stats(organization),
            "teams": cls.get_team_stats(organization),
            "positions": cls.get_position_stats(organization),
            "memberships": cls.get_membership_stats(organization),
            "created_at": organization.created_at.isoformat(),
            "updated_at": organization.updated_at.isoformat(),
        }

    @classmethod
    def get_department_stats(
        cls,
        organization: Organization,
    ) -> dict:
        """
        Get department statistics.

        Args:
            organization: The organization to get stats for

        Returns:
            Dictionary with department statistics
        """
        departments = Department.objects.filter(organization=organization)

        return {
            "total": departments.count(),
            "active": departments.filter(status="active").count(),
            "inactive": departments.filter(status="inactive").count(),
            "by_type": cls._count_by_field(departments, "department_type"),
            "with_managers": departments.exclude(manager=None).count(),
            "without_managers": departments.filter(manager=None).count(),
        }

    @classmethod
    def get_office_stats(
        cls,
        organization: Organization,
    ) -> dict:
        """
        Get office statistics.

        Args:
            organization: The organization to get stats for

        Returns:
            Dictionary with office statistics
        """
        offices = Office.objects.filter(organization=organization)

        return {
            "total": offices.count(),
            "active": offices.filter(status="active").count(),
            "inactive": offices.filter(status="inactive").count(),
            "by_type": cls._count_by_field(offices, "office_type"),
            "by_country": cls._count_by_field(offices, "country"),
            "by_city": cls._count_by_field(offices, "city"),
            "headquarters": offices.filter(is_headquarters=True).count(),
            "with_managers": offices.exclude(manager=None).count(),
            "without_managers": offices.filter(manager=None).count(),
        }

    @classmethod
    def get_team_stats(
        cls,
        organization: Organization,
    ) -> dict:
        """
        Get team statistics.

        Args:
            organization: The organization to get stats for

        Returns:
            Dictionary with team statistics
        """
        teams = Team.objects.filter(organization=organization)

        return {
            "total": teams.count(),
            "active": teams.filter(status="active").count(),
            "inactive": teams.filter(status="inactive").count(),
            "by_department": cls._count_by_field(teams, "department_id"),
            "with_leads": teams.exclude(lead=None).count(),
            "without_leads": teams.filter(lead=None).count(),
            "total_capacity": teams.aggregate(total=Count("id"))["total"] or 0,
        }

    @classmethod
    def get_position_stats(
        cls,
        organization: Organization,
    ) -> dict:
        """
        Get position statistics.

        Args:
            organization: The organization to get stats for

        Returns:
            Dictionary with position statistics
        """
        positions = Position.objects.filter(organization=organization)

        return {
            "total": positions.count(),
            "by_level": cls._count_by_field(positions, "level"),
            "managerial": positions.filter(is_managerial=True).count(),
            "non_managerial": positions.filter(is_managerial=False).count(),
            "by_department": cls._count_by_field(positions, "department_id"),
        }

    @classmethod
    def get_membership_stats(
        cls,
        organization: Organization,
    ) -> dict:
        """
        Get membership statistics.

        Args:
            organization: The organization to get stats for

        Returns:
            Dictionary with membership statistics
        """
        from apps.organization.models.membership import OrganizationMembership

        memberships = OrganizationMembership.objects.filter(organization=organization)

        return {
            "total": memberships.count(),
            "active": memberships.filter(status="active").count(),
            "inactive": memberships.filter(status="inactive").count(),
            "by_role": cls._count_by_field(memberships, "role_id"),
            "by_department": cls._count_by_field(memberships, "department_id"),
            "by_team": cls._count_by_field(memberships, "team_id"),
        }

    @classmethod
    def get_activity_stats(
        cls,
        organization: Organization,
        days: int = 30,
    ) -> dict:
        """
        Get activity statistics for the specified period.

        Args:
            organization: The organization to get stats for
            days: Number of days to look back

        Returns:
            Dictionary with activity statistics
        """
        from apps.organization.models.membership import OrganizationMembership

        cutoff_date = timezone.now() - timedelta(days=days)

        # Get active memberships in the period
        active_memberships = OrganizationMembership.objects.filter(
            organization=organization,
            joined_at__gte=cutoff_date,
        ).exclude(left_at__lt=cutoff_date)

        return {
            "period_days": days,
            "start_date": cutoff_date.isoformat(),
            "end_date": timezone.now().isoformat(),
            "new_memberships": active_memberships.count(),
            "memberships_by_month": cls._get_monthly_breakdown(
                active_memberships,
                "joined_at",
            ),
        }

    @classmethod
    def _count_by_field(
        cls,
        queryset: QuerySet,
        field_name: str,
    ) -> dict:
        """
        Count items by a field.

        Args:
            queryset: The queryset to count
            field_name: The field to group by

        Returns:
            Dictionary with counts by field value
        """
        counts = queryset.values(field_name).annotate(
            count=Count("id"),
        ).order_by()

        return {
            str(item[field_name]): item["count"]
            for item in counts
        }

    @classmethod
    def _get_monthly_breakdown(
        cls,
        queryset: QuerySet,
        date_field: str,
    ) -> dict:
        """
        Get monthly breakdown of items.

        Args:
            queryset: The queryset to analyze
            date_field: The date field to group by

        Returns:
            Dictionary with monthly counts
        """
        from django.db.models import Count
        from django.db.models.functions import TruncMonth

        breakdown = (
            queryset.annotate(month=TruncMonth(date_field))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        return {
            item["month"].isoformat() if item["month"] else "unknown": item["count"]
            for item in breakdown
        }
