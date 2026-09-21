"""
Organization isolation tests for the Organization API.

A member of organization A must never observe or mutate organization B
through list, retrieve, update, delete, search, filters, or the `my`
action — including by direct UUID access.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
)

VIEW = "organization.view"
UPDATE = "organization.update"
DELETE = "organization.delete"


def _member_client(org, *perm_codes):
    user = UserFactory.create()
    role = RoleFactory.create(organization=org)
    for code in perm_codes:
        # Permission is unique on code AND (module, action): derive the pair
        # from dotted codes (`organization.view` → module/action) so repeated
        # helper calls never collide.
        *module_parts, action = code.split(".")
        RolePermissionFactory.create(
            role=role,
            permission=PermissionFactory.create(
                code=code, module=".".join(module_parts), action=action
            ),
        )
    OrganizationMembershipFactory.create(user=user, organization=org, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _list_url():
    return reverse("api:v1:organization:organization-list")


def _detail_url(org):
    return reverse(
        "api:v1:organization:organization-detail",
        kwargs={"uuid": org.uuid},
    )


def _ids(response):
    assert response.status_code == 200, response.data
    return [row["id"] for row in response.data["results"]]


@pytest.mark.django_db
class TestOrganizationIsolation:
    def test_list_shows_only_member_orgs(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        client = _member_client(org_a, VIEW)

        ids = _ids(client.get(_list_url(), **_org_header(org_a)))

        assert ids == [str(org_a.id)]
        assert str(org_b.id) not in ids

    def test_retrieve_foreign_org_404s(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        client = _member_client(org_a, VIEW)

        response = client.get(_detail_url(org_b), **_org_header(org_a))

        assert response.status_code == 404

    def test_update_foreign_org_404s(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        client = _member_client(org_a, VIEW, UPDATE)

        response = client.patch(
            _detail_url(org_b), {"name": "Hijacked"}, format="json", **_org_header(org_a)
        )

        assert response.status_code == 404
        org_b.refresh_from_db()
        assert org_b.name != "Hijacked"

    def test_delete_foreign_org_404s(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        client = _member_client(org_a, VIEW, DELETE)

        response = client.delete(_detail_url(org_b), **_org_header(org_a))

        assert response.status_code == 404
        org_b.refresh_from_db()
        assert org_b.is_deleted is False

    def test_search_never_surfaces_foreign_orgs(self):
        org_a = OrganizationFactory.create(name="Shared Prefix Alpha")
        org_b = OrganizationFactory.create(name="Shared Prefix Beta")
        client = _member_client(org_a, VIEW)

        ids = _ids(
            client.get(_list_url(), {"search": "Shared Prefix"}, **_org_header(org_a))
        )

        assert ids == [str(org_a.id)]
        assert str(org_b.id) not in ids

    def test_filters_never_surface_foreign_orgs(self):
        org_a = OrganizationFactory.create(status="active")
        org_b = OrganizationFactory.create(status="active")
        client = _member_client(org_a, VIEW)

        ids = _ids(
            client.get(_list_url(), {"status": "active"}, **_org_header(org_a))
        )

        assert ids == [str(org_a.id)]
        assert str(org_b.id) not in ids

    def test_my_action_excludes_foreign_orgs(self):
        org_a = OrganizationFactory.create()
        OrganizationFactory.create()
        client = _member_client(org_a, VIEW)

        response = client.get(
            reverse("api:v1:organization:organization-my"), **_org_header(org_a)
        )

        assert response.status_code == 200
        assert [row["id"] for row in response.data["results"]] == [str(org_a.id)]

    def test_legacy_flat_list_respects_isolation(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        client = _member_client(org_a, VIEW)

        response = client.get("/api/v1/organizations/", **_org_header(org_a))

        assert response.status_code == 200
        payload = response.data["results"] if isinstance(response.data, dict) else response.data
        ids = [row["id"] for row in payload]
        assert str(org_a.id) in ids
        assert str(org_b.id) not in ids


@pytest.mark.django_db
class TestGetQuerysetScoping:
    """Unit pins for `OrganizationViewSet.get_queryset` branches."""

    def _view(self, user):
        from django.test import RequestFactory

        from apps.organization.api.viewsets.organization import OrganizationViewSet

        view = OrganizationViewSet()
        request = RequestFactory().get("/")
        request.user = user
        view.request = request
        view.format_kwarg = None
        return view

    def test_anonymous_sees_none(self):
        from django.contrib.auth.models import AnonymousUser

        qs = self._view(AnonymousUser()).get_queryset()

        assert qs.count() == 0

    def test_staff_sees_all(self, staff_user):
        from apps.organization.models import Organization

        keep = OrganizationFactory.create()
        OrganizationFactory.create()

        assert set(self._view(staff_user).get_queryset()) == set(
            Organization.objects.all()
        )
        assert keep in self._view(staff_user).get_queryset()

    def test_member_sees_only_own(self, user):
        from apps.organization.tests.factories import OrganizationMembershipFactory

        org_a = OrganizationFactory.create()
        OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org_a)

        assert list(self._view(user).get_queryset()) == [org_a]

    def test_swagger_fake_view_sees_none(self, staff_user):
        view = self._view(staff_user)
        view.swagger_fake_view = True

        assert view.get_queryset().count() == 0


@pytest.mark.django_db
class TestOrganizationListEdges:
    def test_page_beyond_range_404s_with_detail(self, staff_client):
        OrganizationFactory.create()

        response = staff_client.get(_list_url(), {"page": 999})

        assert response.status_code == 404
        assert "detail" in response.data

    def test_invalid_ordering_is_ignored(self, staff_client):
        org = OrganizationFactory.create(name="Edge Org")

        response = staff_client.get(_list_url(), {"ordering": "bogus_field"})

        assert response.status_code == 200
        assert str(org.id) in [row["id"] for row in response.data["results"]]

    def test_malformed_uuid_detail_404s(self, staff_client):
        org = OrganizationFactory.create()
        url = reverse(
            "api:v1:organization:organization-detail",
            kwargs={"uuid": "not-a-uuid"},
        )

        response = staff_client.get(url, **_org_header(org))

        assert response.status_code == 404

    def test_legacy_malformed_lookup_404s(self, staff_client):
        org = OrganizationFactory.create()

        response = staff_client.get(
            "/api/v1/organizations/not-a-uuid-nor-code/", **_org_header(org)
        )

        assert response.status_code == 404

    def test_list_query_count_bounded(self, staff_client, django_assert_num_queries):
        # Measured 22 for 5 rows: list-serializer computed fields fan out per
        # row. Cap documents current cost and trips on future N+1 growth; the
        # fan-out itself (annotate instead of per-row queries) is a known
        # optimization target, not fixed here.
        OrganizationFactory.create_batch(5)

        with django_assert_num_queries(25, exact=False):
            response = staff_client.get(_list_url())

        assert response.status_code == 200

    def test_retrieve_query_count_bounded(
        self, staff_client, django_assert_num_queries
    ):
        org = OrganizationFactory.create()

        with django_assert_num_queries(10, exact=False):
            response = staff_client.get(_detail_url(org))

        assert response.status_code == 200
