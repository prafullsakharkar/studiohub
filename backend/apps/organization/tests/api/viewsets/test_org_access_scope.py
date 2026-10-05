"""
Strict superuser-only organization scoping (user-specific org access, Task 1).

Only ``is_superuser`` grants all-organization access. Every other user —
including ``is_staff`` users and holders of ``Platform Admin`` / ``Super
Admin`` role labels — sees exactly the organizations of their valid
(``is_deleted=False``) memberships.

URL/envelope conventions mirror
``apps/organization/tests/api/viewsets/test_organization_viewsets.py``:
list via ``api:v1:organization:organization-list`` (paginated ``results``
envelope), detail via ``...:organization-detail`` with the ``uuid`` kwarg.
Member users carry global permission grants (no org header is sent on these
routes, and only global roles apply without an organization context), so
queryset scoping is the only variable under test.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)
from apps.organization.tests.rbac_helpers import grant_all_known_codes


def _list_url():
    return reverse("api:v1:organization:organization-list")


def _detail_url(org):
    return reverse(
        "api:v1:organization:organization-detail",
        kwargs={"uuid": str(org.uuid)},
    )


def _result_ids(response):
    data = response.json()
    items = data["results"] if isinstance(data, dict) and "results" in data else data
    return {str(item["id"]) for item in items}


def _member_client(user):
    """API client for a membership-scoped user (global grants, no org header)."""
    grant_all_known_codes(user)
    api = APIClient()
    api.force_authenticate(user=user)
    return api


@pytest.mark.django_db
def test_member_cannot_open_unpermitted_org():
    """Member of A+B requesting org C detail is rejected (403/404)."""
    org_a = OrganizationFactory.create()
    org_b = OrganizationFactory.create()
    org_c = OrganizationFactory.create()
    user = UserFactory.create()
    OrganizationMembershipFactory.create(user=user, organization=org_a)
    OrganizationMembershipFactory.create(user=user, organization=org_b)
    api = _member_client(user)

    res = api.get(_detail_url(org_c))

    assert res.status_code in (403, 404)


@pytest.mark.django_db
def test_member_list_shows_only_permitted_orgs():
    """Member of A+B sees A+B in the list, never C."""
    org_a = OrganizationFactory.create()
    org_b = OrganizationFactory.create()
    org_c = OrganizationFactory.create()
    user = UserFactory.create()
    OrganizationMembershipFactory.create(user=user, organization=org_a)
    OrganizationMembershipFactory.create(user=user, organization=org_b)
    api = _member_client(user)

    res = api.get(_list_url())

    assert res.status_code == 200
    ids = _result_ids(res)
    assert str(org_a.id) in ids
    assert str(org_b.id) in ids
    assert str(org_c.id) not in ids


@pytest.mark.django_db
def test_staff_non_superuser_gets_member_scope():
    """is_staff without is_superuser grants nothing: staff sees member orgs only."""
    org_a = OrganizationFactory.create()
    org_c = OrganizationFactory.create()
    staff_user = UserFactory.create(is_staff=True, is_superuser=False)
    assert staff_user.is_staff and not staff_user.is_superuser
    OrganizationMembershipFactory.create(user=staff_user, organization=org_a)
    api = _member_client(staff_user)

    res = api.get(_list_url())

    assert res.status_code == 200
    ids = _result_ids(res)
    assert str(org_a.id) in ids and str(org_c.id) not in ids


@pytest.mark.django_db
def test_superuser_sees_all_orgs_without_membership():
    """Superuser lists every org with no memberships (regression pin)."""
    orgs = OrganizationFactory.create_batch(3)
    admin = UserFactory.create(is_staff=True, is_superuser=True)
    api = APIClient()
    api.force_authenticate(user=admin)

    res = api.get(_list_url())

    assert res.status_code == 200
    ids = _result_ids(res)
    for org in orgs:
        assert str(org.id) in ids


@pytest.mark.django_db
def test_soft_deleted_membership_grants_no_access():
    """A soft-deleted membership confers no list/detail access."""
    org_a = OrganizationFactory.create()
    org_c = OrganizationFactory.create()
    user = UserFactory.create()
    OrganizationMembershipFactory.create(user=user, organization=org_a)
    dead = OrganizationMembershipFactory.create(user=user, organization=org_c)
    dead.is_deleted = True
    dead.save(update_fields=["is_deleted", "updated_at"])
    api = _member_client(user)

    list_res = api.get(_list_url())
    assert list_res.status_code == 200
    assert str(org_c.id) not in _result_ids(list_res)

    detail_res = api.get(_detail_url(org_c))
    assert detail_res.status_code in (403, 404)


@pytest.mark.django_db
def test_legacy_singleton_ignores_soft_deleted_membership():
    """GET /api/v1/organization/ 404s when the only membership is soft-deleted."""
    org = OrganizationFactory.create()
    user = UserFactory.create()
    dead = OrganizationMembershipFactory.create(user=user, organization=org)
    dead.is_deleted = True
    dead.save(update_fields=["is_deleted", "updated_at"])
    api = _member_client(user)

    res = api.get("/api/v1/organization/")

    assert res.status_code == 404
