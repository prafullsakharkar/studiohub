"""
Tests for the Organization.status data migration (0019).

The migration lowercases known-but-wrong-case status values (``Active`` ->
``active``) and resets invented legacy statuses (``Onboarding``,
``Suspended``) to the default ``active``. The migration function is invoked
directly (inside the test transaction) rather than through
``MigrationExecutor`` so the test never mutates the database's applied
migration state.
"""

from __future__ import annotations

import importlib

import pytest
from django.apps import apps

from apps.organization.tests.factories import OrganizationFactory

MIGRATION_MODULE = "apps.organization.migrations.0019_normalize_organization_status"


@pytest.fixture
def normalize_statuses():
    """Return the migration's data-normalization function."""
    return importlib.import_module(MIGRATION_MODULE).normalize_organization_statuses


@pytest.mark.django_db
def test_lowercases_known_but_wrong_case_statuses(normalize_statuses):
    canonical = OrganizationFactory.create(code="CAN", status="active")
    title_case = OrganizationFactory.create(code="TIT", status="Active")
    uppercase = OrganizationFactory.create(code="UPP", status="ARCHIVED")

    normalize_statuses(apps, None)

    canonical.refresh_from_db()
    title_case.refresh_from_db()
    uppercase.refresh_from_db()
    assert canonical.status == "active"
    assert title_case.status == "active"
    assert uppercase.status == "archived"


@pytest.mark.django_db
def test_invented_legacy_statuses_fall_back_to_default(normalize_statuses):
    invented = OrganizationFactory.create(code="INV", status="Onboarding")
    suspended = OrganizationFactory.create(code="SUS", status="Suspended")

    normalize_statuses(apps, None)

    invented.refresh_from_db()
    suspended.refresh_from_db()
    assert invented.status == "active"
    assert suspended.status == "active"


@pytest.mark.django_db
def test_canonical_statuses_are_untouched(normalize_statuses):
    active = OrganizationFactory.create(code="ACT", status="active")
    draft = OrganizationFactory.create(code="DRF", status="draft")
    archived = OrganizationFactory.create(code="ARC", status="archived")

    normalize_statuses(apps, None)

    active.refresh_from_db()
    draft.refresh_from_db()
    archived.refresh_from_db()
    assert active.status == "active"
    assert draft.status == "draft"
    assert archived.status == "archived"
