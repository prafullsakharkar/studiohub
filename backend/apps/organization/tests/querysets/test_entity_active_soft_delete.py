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
