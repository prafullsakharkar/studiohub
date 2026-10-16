"""
Tests for the persisted saved/recent search endpoints (platform-global).

Contract: studiohub-react `SearchService.ts` — bare-array lists, 201 with real
ids on create, 204 on delete/clear, 400 on blank recent query. Searches are
owned by the authenticated user with no organization partition.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.intelligence.models import RecentSearch, SavedSearch

SAVED_URL = reverse("api:v1:intelligence:intelligence-search-saved")
RECENT_URL = reverse("api:v1:intelligence:intelligence-search-recent")


def _saved_detail_url(search_id):
    return reverse(
        "api:v1:intelligence:intelligence-search-saved-detail",
        kwargs={"pk": str(search_id)},
    )


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestSavedSearch:
    @pytest.mark.django_db
    def test_list_unauthenticated_401(self, api_client):
        assert api_client.get(SAVED_URL).status_code == 401

    @pytest.mark.django_db
    def test_create_list_detail_delete_round_trip(self, staff_client, staff_user):
        payload = {
            "name": "Comp shots",
            "description": "All comp work",
            "filters": {"query": "comp", "entity_types": ["shot"]},
            "is_favorite": True,
            # Client-supplied user_id must be ignored (never trust IDs).
            "user_id": "usr-001",
        }
        created = staff_client.post(SAVED_URL, payload, format="json")

        assert created.status_code == 201, created.data
        assert created.data["name"] == "Comp shots"
        assert created.data["filters"] == {"query": "comp", "entity_types": ["shot"]}
        assert created.data["is_favorite"] is True
        assert created.data["user_id"] == str(staff_user.id)
        assert created.data["id"] != "save-001"

        listed = staff_client.get(SAVED_URL)
        assert listed.status_code == 200
        assert [row["id"] for row in listed.data] == [created.data["id"]]

        detail = staff_client.get(_saved_detail_url(created.data["id"]))
        assert detail.status_code == 200
        assert detail.data["name"] == "Comp shots"

        deleted = staff_client.delete(_saved_detail_url(created.data["id"]))
        assert deleted.status_code == 204
        assert SavedSearch.objects.filter(id=created.data["id"]).count() == 0

    @pytest.mark.django_db
    def test_create_requires_name(self, staff_client):
        resp = staff_client.post(SAVED_URL, {"filters": {}}, format="json")
        assert resp.status_code == 400

    @pytest.mark.django_db
    def test_user_isolation(self, auth_client, user):
        other = UserFactory.create()
        mine = SavedSearch.objects.create(user=user, name="Mine")
        SavedSearch.objects.create(user=other, name="Theirs")

        listed = auth_client.get(SAVED_URL)
        assert [row["id"] for row in listed.data] == [str(mine.id)]


class TestRecentSearch:
    @pytest.mark.django_db
    def test_list_unauthenticated_401(self, api_client):
        assert api_client.get(RECENT_URL).status_code == 401

    @pytest.mark.django_db
    def test_create_list_clear_round_trip(self, staff_client):
        created = staff_client.post(
            RECENT_URL,
            {"query": " pyro  ", "filters_snapshot": {"departments": ["FX"]}},
            format="json",
        )

        assert created.status_code == 201, created.data
        assert created.data["query"] == "pyro"
        assert created.data["filters_snapshot"] == {"departments": ["FX"]}
        assert created.data["timestamp"]
        assert created.data["id"] != "rec-001"

        listed = staff_client.get(RECENT_URL)
        assert [row["id"] for row in listed.data] == [created.data["id"]]

        cleared = staff_client.delete(RECENT_URL)
        assert cleared.status_code == 204
        assert staff_client.get(RECENT_URL).data == []

    @pytest.mark.django_db
    def test_blank_query_400(self, staff_client):
        resp = staff_client.post(RECENT_URL, {"query": "   "}, format="json")
        assert resp.status_code == 400

    @pytest.mark.django_db
    def test_user_isolation(self, auth_client, user):
        other = UserFactory.create()
        RecentSearch.objects.create(user=other, query="theirs")

        listed = auth_client.get(RECENT_URL)
        assert listed.data == []
