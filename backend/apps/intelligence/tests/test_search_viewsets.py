"""
Tests for the persisted saved/recent search endpoints.

Contract: studiohub-react `SearchService.ts` — bare-array lists, 201 with real
ids on create, 204 on delete/clear, 400 on blank recent query.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.intelligence.models import RecentSearch, SavedSearch
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)

SAVED_URL = reverse("api:v1:intelligence:intelligence-search-saved")
RECENT_URL = reverse("api:v1:intelligence:intelligence-search-recent")


def _saved_detail_url(search_id):
    return reverse(
        "api:v1:intelligence:intelligence-search-saved-detail",
        kwargs={"pk": str(search_id)},
    )


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def member_user(db):
    user = UserFactory.create()
    org = OrganizationFactory.create()
    OrganizationMembershipFactory.create(user=user, organization=org)
    return user, org


class TestSavedSearch:
    @pytest.mark.django_db
    def test_list_unauthenticated_401(self, api_client):
        assert api_client.get(SAVED_URL).status_code == 401

    @pytest.mark.django_db
    def test_create_list_detail_delete_round_trip(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=staff_user, organization=org)
        payload = {
            "name": "Comp shots",
            "description": "All comp work",
            "filters": {"query": "comp", "entity_types": ["shot"]},
            "is_favorite": True,
            # Client-supplied user_id must be ignored (never trust IDs).
            "user_id": "usr-001",
        }
        created = staff_client.post(SAVED_URL, payload, **_org_header(org), format="json")

        assert created.status_code == 201, created.data
        assert created.data["name"] == "Comp shots"
        assert created.data["filters"] == {"query": "comp", "entity_types": ["shot"]}
        assert created.data["is_favorite"] is True
        assert created.data["user_id"] == str(staff_user.id)
        assert created.data["id"] != "save-001"

        listed = staff_client.get(SAVED_URL, **_org_header(org))
        assert listed.status_code == 200
        assert [row["id"] for row in listed.data] == [created.data["id"]]

        detail = staff_client.get(_saved_detail_url(created.data["id"]), **_org_header(org))
        assert detail.status_code == 200
        assert detail.data["name"] == "Comp shots"

        deleted = staff_client.delete(
            _saved_detail_url(created.data["id"]), **_org_header(org)
        )
        assert deleted.status_code == 204
        assert SavedSearch.objects.filter(id=created.data["id"]).count() == 0

    @pytest.mark.django_db
    def test_create_requires_name(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=staff_user, organization=org)
        resp = staff_client.post(SAVED_URL, {"filters": {}}, **_org_header(org), format="json")
        assert resp.status_code == 400

    @pytest.mark.django_db
    def test_user_isolation(self, auth_client, user, member_user):
        other, org = member_user
        OrganizationMembershipFactory.create(user=user, organization=org)
        mine = SavedSearch.objects.create(organization=org, user=user, name="Mine")
        SavedSearch.objects.create(organization=org, user=other, name="Theirs")

        listed = auth_client.get(SAVED_URL, **_org_header(org))
        assert [row["id"] for row in listed.data] == [str(mine.id)]

    @pytest.mark.django_db
    def test_org_isolation(self, auth_client, user):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org_a)
        OrganizationMembershipFactory.create(user=user, organization=org_b)
        SavedSearch.objects.create(organization=org_a, user=user, name="In A")

        listed = auth_client.get(SAVED_URL, **_org_header(org_b))
        assert listed.data == []

    @pytest.mark.django_db
    def test_no_organization_404_on_create(self, auth_client):
        resp = auth_client.post(SAVED_URL, {"name": "X"}, format="json")
        assert resp.status_code == 404


class TestRecentSearch:
    @pytest.mark.django_db
    def test_list_unauthenticated_401(self, api_client):
        assert api_client.get(RECENT_URL).status_code == 401

    @pytest.mark.django_db
    def test_create_list_clear_round_trip(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=staff_user, organization=org)
        created = staff_client.post(
            RECENT_URL,
            {"query": " pyro  ", "filters_snapshot": {"departments": ["FX"]}},
            **_org_header(org),
            format="json",
        )

        assert created.status_code == 201, created.data
        assert created.data["query"] == "pyro"
        assert created.data["filters_snapshot"] == {"departments": ["FX"]}
        assert created.data["timestamp"]
        assert created.data["id"] != "rec-001"

        listed = staff_client.get(RECENT_URL, **_org_header(org))
        assert [row["id"] for row in listed.data] == [created.data["id"]]

        cleared = staff_client.delete(RECENT_URL, **_org_header(org))
        assert cleared.status_code == 204
        assert staff_client.get(RECENT_URL, **_org_header(org)).data == []

    @pytest.mark.django_db
    def test_blank_query_400(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=staff_user, organization=org)
        resp = staff_client.post(RECENT_URL, {"query": "   "}, **_org_header(org), format="json")
        assert resp.status_code == 400

    @pytest.mark.django_db
    def test_user_and_org_isolation(self, auth_client, user, member_user):
        other, org = member_user
        OrganizationMembershipFactory.create(user=user, organization=org)
        RecentSearch.objects.create(organization=org, user=other, query="theirs")

        listed = auth_client.get(RECENT_URL, **_org_header(org))
        assert listed.data == []
