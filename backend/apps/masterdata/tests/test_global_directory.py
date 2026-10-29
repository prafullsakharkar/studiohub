"""Global directory tests.

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

# Isolated URLconf: mounts only the masterdata and RBAC routes, so these tests
# prove the flat global endpoints serve global rows without the rest of the project.
urlpatterns = [
    url_path("", include("apps.masterdata.api.urls")),
    url_path("", include(("apps.identity.api.urls_rbac", "identity-rbac"))),
]


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


@override_settings(ROOT_URLCONF="apps.masterdata.tests.test_global_directory")
def test_flat_rbac_endpoints_serve_global_rows(api_client, django_user):
    from apps.identity.models import Group, Permission, Role

    Role.objects.create(name="Artist", code="artist")
    Group.objects.create(name="Supervisors", code="supervisors")
    Permission.objects.create(
        name="Can view roles",
        code="role.view",
        module="role",
        action="view",
        category="general",
    )

    api_client.force_authenticate(user=django_user)
    for route, key in [
        ("identity-rbac:role-list", "artist"),
        ("identity-rbac:group-list", "supervisors"),
        ("identity-rbac:permission-list", "role.view"),
    ]:
        response = api_client.get(reverse(route))
        assert response.status_code == 200, response.content
        assert set(response.data) >= {"count", "next", "previous", "results"}
        assert key in {row["code"] for row in response.data["results"]}, route


@override_settings(ROOT_URLCONF="apps.masterdata.tests.test_global_directory")
def test_flat_directory_list_is_paginated(api_client, django_user):
    Department.objects.create(name="Compositing", code="COMP", department_type="creative")

    api_client.force_authenticate(user=django_user)
    response = api_client.get(reverse("masterdata:department-list"))
    assert response.status_code == 200, response.content
    assert set(response.data) >= {"count", "next", "previous", "results"}
    assert response.data["count"] >= 1


@override_settings(ROOT_URLCONF="apps.masterdata.tests.test_global_directory")
def test_flat_directory_write_requires_configure_grant(api_client, django_user):
    api_client.force_authenticate(user=django_user)
    response = api_client.post(
        reverse("masterdata:department-list"),
        {"name": "Editing", "code": "EDIT", "department_type": "creative"},
        format="json",
    )
    assert response.status_code == 403, response.content
