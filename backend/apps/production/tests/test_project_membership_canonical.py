"""
ProjectMembership canonical status + role link (N2/N7 consolidation).
"""

from __future__ import annotations

import importlib

import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from apps.organization.models import Organization
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

User = get_user_model()

STATUS_MIGRATION_MODULE = "apps.production.migrations.0018_map_project_membership_status"


def make_membership(status="Active", role="Artist"):
    org = Organization.objects.create(code="PMX", name="PMX", slug="pmx")
    user = User.objects.create_user(email="m@pmx.io", password="x")
    project = ProjectFactory.create(organization=org)
    return ProjectMembership.objects.create(
        organization=org, project=project, user=user, status=status, role=role
    )


@pytest.mark.django_db
def test_save_normalizes_known_status_case():
    m = make_membership("Active")
    m.refresh_from_db()
    assert m.status == "active"


@pytest.mark.django_db
def test_backfill_maps_unknown_status_to_active():
    backfill = importlib.import_module(
        STATUS_MIGRATION_MODULE
    ).backfill_project_membership_statuses
    # Bypass save() normalization to plant a genuinely unknown value.
    m = make_membership("active")
    ProjectMembership.objects.filter(id=m.id).update(status="Pending")

    backfill(apps, None)
    m.refresh_from_db()

    assert m.status == "active"


@pytest.mark.django_db
def test_status_choices_reject_garbage_on_save():
    m = make_membership("active")
    m.status = "bogus"
    with pytest.raises(ValidationError):
        m.full_clean()
