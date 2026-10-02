"""Tests for org master-data catalog bulk-enable (no copy) endpoint."""

from __future__ import annotations

import uuid

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.masterdata.models import MasterFileType, MasterTaskType
from apps.organization.tests.factories import OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_permissions


@pytest.fixture
def organization(db):
    return OrganizationFactory.create()


@pytest.fixture
def org_admin(organization):
    user = UserFactory.create()
    grant_permissions(
        user, "organization.master_data.configure", organization=organization
    )
    return user


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_bulk_enable_task_types(api_client, organization, org_admin):
    t1 = MasterTaskType.objects.create(name="Animation", code="ANIM")
    t2 = MasterTaskType.objects.create(name="Lighting", code="LIGHT")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/v1/organizations/{organization.id}/master-data/task-types/bulk-enable",
        {"ids": [str(t1.id), str(t2.id)]},
        format="json",
    )
    assert res.status_code == 200, res.content
    assert res.data["enabled_count"] == 2
    again = api_client.post(
        f"/api/v1/organizations/{organization.id}/master-data/task-types/bulk-enable",
        {"ids": [str(t1.id)]},
        format="json",
    )
    assert again.data["enabled_count"] == 0
    assert again.data["existing_count"] == 1


@pytest.mark.django_db
def test_bulk_enable_rejects_malformed_ids(api_client, organization, org_admin):
    api_client.force_authenticate(org_admin)
    url = f"/api/v1/organizations/{organization.id}/master-data/task-types/bulk-enable"
    res = api_client.post(url, {"ids": "not-a-list"}, format="json")
    assert res.status_code == 400
    res = api_client.post(url, {"ids": ["not-a-uuid"]}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_bulk_enable_skips_unknown_ids(api_client, organization, org_admin):
    t1 = MasterTaskType.objects.create(name="Animation", code="ANIM2")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/v1/organizations/{organization.id}/master-data/task-types/bulk-enable",
        {"ids": [str(t1.id), str(uuid.uuid4())]},
        format="json",
    )
    assert res.status_code == 200, res.content
    assert res.data["enabled_count"] == 1
    assert res.data["existing_count"] == 0


@pytest.mark.django_db
def test_bulk_enable_unknown_type_404(api_client, organization, org_admin):
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/v1/organizations/{organization.id}/master-data/nope/bulk-enable",
        {"ids": []},
        format="json",
    )
    assert res.status_code == 404


@pytest.mark.django_db
def test_bulk_enable_file_types(api_client, organization, org_admin):
    f1 = MasterFileType.objects.create(name="EXR", code="EXR")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/v1/organizations/{organization.id}/master-data/file-types/bulk-enable",
        {"ids": [str(f1.id)]},
        format="json",
    )
    assert res.status_code == 200, res.content
    assert res.data["enabled_count"] == 1
