"""
Regression: soft-deleted org entities must be excluded from active().

Department/Team/Office have no ``status`` field, so
``OrganizationEntityQuerySet.active()`` previously returned the full
queryset, leaking soft-deleted rows into list endpoints.
"""

from __future__ import annotations

import pytest

from apps.organization.models import Department, Office, Team
from apps.organization.selectors.department import DepartmentSelector


class TestEntityActiveExcludesSoftDeleted:
    @pytest.mark.django_db
    def test_department_active_excludes_soft_deleted(self, department):
        Department.objects.filter(pk=department.pk).update(is_deleted=True)
        assert not Department.objects.active().filter(pk=department.pk).exists()
        assert Department.objects.all().filter(pk=department.pk).exists()

    @pytest.mark.django_db
    def test_department_selector_get_queryset_excludes_soft_deleted(self, department):
        Department.objects.filter(pk=department.pk).update(is_deleted=True)
        qs = DepartmentSelector.get_queryset()
        assert not qs.filter(pk=department.pk).exists()

    @pytest.mark.django_db
    def test_team_and_office_active_exclude_soft_deleted(self, team, office):
        Team.objects.filter(pk=team.pk).update(is_deleted=True)
        Office.objects.filter(pk=office.pk).update(is_deleted=True)
        assert not Team.objects.active().filter(pk=team.pk).exists()
        assert not Office.objects.active().filter(pk=office.pk).exists()


class TestCalendarFamilySelectorsExcludeSoftDeleted:
    @pytest.mark.django_db
    def test_calendar_selector_excludes_soft_deleted(self, calendar):
        from apps.organization.models import Calendar
        from apps.organization.selectors.calendar import CalendarSelector

        Calendar.objects.filter(pk=calendar.pk).update(is_deleted=True)
        assert not CalendarSelector.get_queryset().filter(pk=calendar.pk).exists()

    @pytest.mark.django_db
    def test_work_calendar_selector_excludes_soft_deleted(self, work_calendar):
        from apps.organization.models import WorkCalendar
        from apps.organization.selectors.work_calendar import WorkCalendarSelector

        WorkCalendar.objects.filter(pk=work_calendar.pk).update(is_deleted=True)
        assert not WorkCalendarSelector.get_queryset().filter(pk=work_calendar.pk).exists()

    @pytest.mark.django_db
    def test_holiday_selector_excludes_soft_deleted(self, holiday):
        from apps.organization.models import Holiday
        from apps.organization.selectors.holiday import HolidaySelector

        Holiday.objects.filter(pk=holiday.pk).update(is_deleted=True)
        assert not HolidaySelector.get_queryset().filter(pk=holiday.pk).exists()

    @pytest.mark.django_db
    def test_inactive_excludes_soft_deleted(self, department):
        Department.objects.filter(pk=department.pk).update(is_deleted=True)
        assert not Department.objects.inactive().filter(pk=department.pk).exists()

