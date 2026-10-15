"""Global directory tests (org-removal B3).

Masterdata absorbs the global directory + reference data: Person,
Client/Vendor (+ contacts/contracts), Department, Team, Office, Position
live in masterdata as platform-global models (no organization FK) and are
served from flat ``/api/v1/...`` endpoints.
"""

from __future__ import annotations

import pytest
from django.test import override_settings
from django.urls import include, reverse
from django.urls import path as url_path
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.masterdata.models import (
    Client,
    Department,
    Office,
    Person,
    Position,
    Team,
    Vendor,
)

pytestmark = pytest.mark.django_db

# Isolated URLconf: the project URLconf still mounts the legacy
# organization flat routes ahead of masterdata's, so plain HTTP GETs on
# /api/v1/departments|people/ resolve to the legacy viewsets until the
# organization app is removed. These tests drive masterdata's viewsets
# directly to prove the new global endpoints serve global rows.
urlpatterns = [url_path("", include("apps.masterdata.api.urls"))]


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def django_user(db):
    return UserFactory.create()


def test_directory_endpoints_are_flat(api_client, django_user):
    api_client.force_authenticate(user=django_user)
    for path in ["departments", "clients", "vendors", "people"]:
        response = api_client.get(f"/api/v1/{path}/")
        assert response.status_code in (200, 403), path


def test_global_directory_models_carry_no_organization_field():
    for model in (Department, Team, Office, Position, Person, Client, Vendor):
        field_names = {field.name for field in model._meta.fields}
        assert "organization" not in field_names, model.__name__


@override_settings(ROOT_URLCONF="apps.masterdata.tests.test_global_directory")
def test_flat_directory_endpoints_serve_global_rows(api_client, django_user):
    department = Department.objects.create(
        name="Compositing", code="COMP", department_type="creative"
    )
    Person.objects.create(name="Jane Doe", department=department)

    api_client.force_authenticate(user=django_user)
    response = api_client.get(reverse("masterdata:department-list"))
    assert response.status_code == 200, response.content
    assert {row["code"] for row in response.data["results"]} >= {"COMP"}

    people = api_client.get(reverse("masterdata:person-list"))
    assert people.status_code == 200, people.content
    assert {row["name"] for row in people.data["results"]} >= {"Jane Doe"}
