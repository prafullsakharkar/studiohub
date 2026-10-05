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

import json

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    ClientFactory,
    DepartmentFactory,
    OfficeFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    PersonFactory,
    TeamFactory,
    VendorFactory,
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


# ----------------------------------------------------------------------
# Task 2: IDOR matrix for org/project/search endpoints.
#
# User 2 is a member of org A+B (global permission grants, so queryset /
# membership scoping is the only variable). Every request scoped to org C
# must be rejected (403/404 per established convention) and must never
# leak C rows.
#
# Real routes (resolved from the source, not invented):
# - Nested org tree: /api/organizations/<org>/<resource>/ (no /v1/;
#   apps/organization/api/urls_nested.py). There is NO nested `projects`
#   list route — org projects go through the flat /api/v1/projects/ view
#   with the X-Organization-Id header. There is NO org-level `dashboard`
#   route — dashboard coverage is the analytics KPIs view, the project
#   dashboard action, and the project-scoped nested dashboard view. There
#   are NO dedicated org/project search endpoints (checked
#   apps/*/api/*search*: only the intelligence search views plus
#   filter/selector `search` mixins exist) — search coverage is the
#   `?search=` param on the org/project lists plus the intelligence stub.
# ----------------------------------------------------------------------

_RESOURCE_SEEDERS = {
    # resource: (factory, marker-name)
    "people": (PersonFactory, "C-Only Person P4"),
    "departments": (DepartmentFactory, "C-Only Department P4"),
    "teams": (TeamFactory, "C-Only Team P4"),
    "offices": (OfficeFactory, "C-Only Office P4"),
    "clients": (ClientFactory, "C-Only Client P4"),
    "vendors": (VendorFactory, "C-Only Vendor P4"),
}


def _setup_ab_member():
    """Orgs A+B+C plus user2 (member of A+B) with global grants."""
    org_a = OrganizationFactory.create()
    org_b = OrganizationFactory.create()
    org_c = OrganizationFactory.create()
    user = UserFactory.create()
    OrganizationMembershipFactory.create(user=user, organization=org_a)
    OrganizationMembershipFactory.create(user=user, organization=org_b)
    return org_a, org_b, org_c, user, _member_client(user)


def _nested_list_url(org, resource):
    return f"/api/organizations/{org.id}/{resource}/"


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _response_names(response):
    """Names in a list response (paginated `results` or bare array)."""
    data = response.json()
    items = data["results"] if isinstance(data, dict) and "results" in data else data
    return [item.get("name") for item in items if isinstance(item, dict)]


@pytest.mark.django_db
@pytest.mark.parametrize("resource", list(_RESOURCE_SEEDERS))
def test_member_cannot_list_unpermitted_org_resource(resource):
    """Member of A+B requesting org C's nested <resource> list: 403/404."""
    org_a, org_b, org_c, user, api = _setup_ab_member()
    factory, marker = _RESOURCE_SEEDERS[resource]
    factory.create(organization=org_c, name=marker)

    res = api.get(_nested_list_url(org_c, resource))

    assert res.status_code in (403, 404)
    assert marker not in json.dumps(res.data)


@pytest.mark.django_db
@pytest.mark.parametrize("resource", list(_RESOURCE_SEEDERS))
def test_member_cannot_open_unpermitted_org_resource_detail(resource):
    """Member of A+B requesting an org C <resource> row by URL id: 403/404."""
    org_a, org_b, org_c, user, api = _setup_ab_member()
    factory, marker = _RESOURCE_SEEDERS[resource]
    row = factory.create(organization=org_c, name=marker)

    res = api.get(f"/api/organizations/{org_c.id}/{resource}/{row.id}/")

    assert res.status_code in (403, 404)


@pytest.mark.django_db
@pytest.mark.parametrize("resource", list(_RESOURCE_SEEDERS))
def test_member_can_list_permitted_org_resource(resource):
    """Positive control: member of A+B CAN list org A's nested <resource>."""
    org_a, org_b, org_c, user, api = _setup_ab_member()
    factory, _ = _RESOURCE_SEEDERS[resource]
    row = factory.create(organization=org_a, name="A-Visible Row")

    res = api.get(_nested_list_url(org_a, resource))

    assert res.status_code == 200
    assert "A-Visible Row" in _response_names(res)


@pytest.mark.django_db
def test_superuser_can_list_unpermitted_org_resource():
    """Positive control: superuser break-glass still lists org C nested rows."""
    org_a, org_b, org_c, user, api = _setup_ab_member()
    ClientFactory.create(organization=org_c, name="C-Only Client P4")
    admin = UserFactory.create(is_staff=True, is_superuser=True)
    admin_api = APIClient()
    admin_api.force_authenticate(user=admin)

    res = admin_api.get(_nested_list_url(org_c, "clients"))

    assert res.status_code == 200
    assert "C-Only Client P4" in _response_names(res)


@pytest.mark.django_db
@pytest.mark.parametrize("resource", ["people", "departments", "teams", "offices", "clients", "vendors"])
def test_member_flat_list_with_unpermitted_org_header_leaks_nothing(resource):
    """Flat /api/v1/<resource>/ with X-Organization-Id: C returns no C rows."""
    org_a, org_b, org_c, user, api = _setup_ab_member()
    factory, marker = _RESOURCE_SEEDERS[resource]
    factory.create(organization=org_c, name=marker)

    res = api.get(f"/api/v1/{resource}/", **_org_header(org_c))

    assert res.status_code == 200
    assert marker not in _response_names(res)


@pytest.mark.django_db
def test_member_cannot_list_unpermitted_org_projects():
    """Member of A+B listing projects with X-Organization-Id: C: no C rows."""
    from apps.production.tests.factories import ProjectFactory

    org_a, org_b, org_c, user, api = _setup_ab_member()
    ProjectFactory.create(organization=org_c, name="Project 4")

    res = api.get("/api/v1/projects/", **_org_header(org_c))

    assert res.status_code == 200
    assert "Project 4" not in json.dumps(res.data)


@pytest.mark.django_db
def test_member_cannot_open_unpermitted_org_project_detail():
    """Member of A+B requesting an org C project by URL id: 403/404."""
    from apps.production.tests.factories import ProjectFactory

    org_a, org_b, org_c, user, api = _setup_ab_member()
    project_c = ProjectFactory.create(organization=org_c, name="Project 4")

    res = api.get(f"/api/v1/projects/{project_c.id}/", **_org_header(org_c))

    assert res.status_code in (403, 404)


@pytest.mark.django_db
def test_project_detail_respects_project_rules_on_top():
    """Org membership alone grants no project read: A's project, no project
    membership and no ADMIN org role → 403/404 (project rules on top)."""
    from apps.production.tests.factories import ProjectFactory

    org_a, org_b, org_c, user, api = _setup_ab_member()
    project_a = ProjectFactory.create(organization=org_a, name="A Project P4")

    res = api.get(f"/api/v1/projects/{project_a.id}/", **_org_header(org_a))

    assert res.status_code in (403, 404)


@pytest.mark.django_db
def test_member_cannot_open_project_dashboard_of_unpermitted_org():
    """Project dashboard action for an org C project: 403/404."""
    from apps.production.tests.factories import ProjectFactory

    org_a, org_b, org_c, user, api = _setup_ab_member()
    project_c = ProjectFactory.create(organization=org_c, name="Project 4")

    res = api.get(
        f"/api/v1/projects/{project_c.id}/dashboard/", **_org_header(org_c)
    )

    assert res.status_code in (403, 404)


@pytest.mark.django_db
def test_member_cannot_open_project_scoped_nested_dashboard():
    """Project-scoped nested dashboard under org C: 403/404."""
    from apps.production.tests.factories import ProjectFactory

    org_a, org_b, org_c, user, api = _setup_ab_member()
    project_c = ProjectFactory.create(organization=org_c, name="Project 4")

    res = api.get(
        f"/api/organizations/{org_c.id}/projects/{project_c.id}/dashboard"
    )

    assert res.status_code in (403, 404)


@pytest.mark.django_db
def test_member_cannot_list_unpermitted_org_reports():
    """Reports scoped to org C via header: no C rows leak."""
    from apps.platform.models import ProductionReport

    org_a, org_b, org_c, user, api = _setup_ab_member()
    ProductionReport.objects.create(
        title="C-Only Report P4", category="Production", organization=org_c
    )

    res = api.get(
        reverse("api:v1:platform:report-list"), **_org_header(org_c)
    )

    assert res.status_code == 200
    assert "C-Only Report P4" not in json.dumps(res.data)


@pytest.mark.django_db
def test_member_org_search_excludes_unpermitted_org():
    """Org list ?search= matching org C: C never appears."""
    org_a, org_b, org_c, user, api = _setup_ab_member()

    res = api.get(_list_url(), {"search": org_c.name})

    assert res.status_code == 200
    assert str(org_c.id) not in _result_ids(res)


@pytest.mark.django_db
def test_member_project_search_excludes_unpermitted_org():
    """Project list ?search= matching 'Project 4' under header C: no leak."""
    from apps.production.tests.factories import ProjectFactory

    org_a, org_b, org_c, user, api = _setup_ab_member()
    ProjectFactory.create(organization=org_c, name="Project 4")

    res = api.get("/api/v1/projects/", {"search": "Project 4"}, **_org_header(org_c))

    assert res.status_code == 200
    assert "Project 4" not in json.dumps(res.data)


@pytest.mark.django_db
def test_member_analytics_dashboard_of_unpermitted_org_404():
    """Analytics KPIs dashboard with X-Organization-Id: C: 404."""
    org_a, org_b, org_c, user, api = _setup_ab_member()

    res = api.get("/api/v1/analytics/kpis/", **_org_header(org_c))

    assert res.status_code == 404


@pytest.mark.django_db
def test_global_search_returns_no_cross_org_results():
    """Intelligence global search is an empty stub: nothing leaks for C."""
    org_a, org_b, org_c, user, api = _setup_ab_member()

    res = api.get(
        reverse("api:v1:intelligence:intelligence-search"),
        {"query": "Project 4"},
        **_org_header(org_c),
    )

    assert res.status_code == 200
    assert res.data["results"] == []


@pytest.mark.django_db
def test_saved_search_scoped_to_unpermitted_org_is_empty():
    """Saved searches listed under header C show no member-of-A+B rows."""
    from apps.intelligence.models import SavedSearch

    org_a, org_b, org_c, user, api = _setup_ab_member()
    SavedSearch.objects.create(organization=org_a, user=user, name="Mine In A")

    res = api.get(
        reverse("api:v1:intelligence:intelligence-search-saved"),
        **_org_header(org_c),
    )

    assert res.status_code == 200
    assert res.data == []


@pytest.mark.django_db
def test_masterdata_bundle_of_unpermitted_org_denied():
    """Master-data bundle for org C: 403/404."""
    org_a, org_b, org_c, user, api = _setup_ab_member()

    res = api.get(
        reverse(
            "api:v1:masterdata:organization-master-data-bundle",
            kwargs={"organization_id": str(org_c.id)},
        )
    )

    assert res.status_code in (403, 404)
