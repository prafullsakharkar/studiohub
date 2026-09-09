"""
Tests for the persisted knowledge-base endpoints.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.intelligence.models import KnowledgeDocument
from apps.intelligence.tests.factories import KnowledgeDocumentFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)

LIST_URL = reverse("api:v1:intelligence:intelligence-knowledge-list")


def _detail_url(doc):
    return reverse(
        "api:v1:intelligence:intelligence-knowledge-detail",
        kwargs={"pk": str(doc.id)},
    )


def _doc_payload(**overrides):
    data = {
        "title": "OpenUSD Standard",
        "slug": "openusd-standard",
        "summary": "Authoring conventions.",
        "content_markdown": "# OpenUSD",
        "category": "pipeline",
        "tags": ["USD"],
        "author_name": "Pipeline TD",
        "author_role": "Pipeline TD",
        "version": "1.0",
    }
    data.update(overrides)
    return data


class TestKnowledgeListCreate:
    @pytest.mark.django_db
    def test_list_unauthenticated_401(self, api_client):
        response = api_client.get(LIST_URL)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_and_filter(self, staff_client):
        org = OrganizationFactory.create()
        match = KnowledgeDocumentFactory.create(
            organization=org, category="pipeline", title="USD Guide"
        )
        KnowledgeDocumentFactory.create(
            organization=org, category="security", title="Vault Policy"
        )

        response = staff_client.get(LIST_URL)

        assert response.status_code == 200
        assert len(response.json()) == 2

        response = staff_client.get(LIST_URL, {"category": "pipeline"})
        assert [row["id"] for row in response.json()] == [str(match.id)]

        response = staff_client.get(LIST_URL, {"search": "vault"})
        assert len(response.json()) == 1

    @pytest.mark.django_db
    def test_create_persists(self, staff_client):
        OrganizationFactory.create()

        response = staff_client.post(LIST_URL, _doc_payload(), format="json")

        assert response.status_code == 201
        assert response.json()["slug"] == "openusd-standard"
        assert KnowledgeDocument.objects.filter(slug="openusd-standard").exists()

    @pytest.mark.django_db
    def test_list_isolated_by_org(self, db):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        KnowledgeDocumentFactory.create(organization=org_a)
        KnowledgeDocumentFactory.create(organization=org_b)
        user = UserFactory.create()
        OrganizationMembershipFactory.create(organization=org_b, user=user)
        api = APIClient()
        api.force_authenticate(user=user)
        api.credentials(HTTP_X_ORGANIZATION_ID=str(org_b.id))

        response = api.get(LIST_URL)

        assert response.status_code == 200
        assert len(response.json()) == 1


class TestKnowledgeDetail:
    @pytest.mark.django_db
    def test_retrieve_increments_views(self, staff_client):
        doc = KnowledgeDocumentFactory.create()

        response = staff_client.get(_detail_url(doc))

        assert response.status_code == 200
        assert response.json()["views_count"] == 1
        doc.refresh_from_db()
        assert doc.views_count == 1

    @pytest.mark.django_db
    def test_retrieve_missing_404(self, staff_client):
        from uuid import uuid4

        url = reverse(
            "api:v1:intelligence:intelligence-knowledge-detail",
            kwargs={"pk": str(uuid4())},
        )

        assert staff_client.get(url).status_code == 404

    @pytest.mark.django_db
    def test_patch_and_delete(self, staff_client):
        doc = KnowledgeDocumentFactory.create()

        response = staff_client.patch(
            _detail_url(doc), {"title": "Renamed"}, format="json"
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Renamed"

        response = staff_client.delete(_detail_url(doc))

        assert response.status_code == 204
        assert staff_client.get(_detail_url(doc)).status_code == 404

    @pytest.mark.django_db
    def test_like(self, staff_client):
        doc = KnowledgeDocumentFactory.create()
        url = reverse(
            "api:v1:intelligence:intelligence-knowledge-like",
            kwargs={"pk": str(doc.id)},
        )

        response = staff_client.post(url)

        assert response.status_code == 200
        assert response.json() == {"likes_count": 1}

    @pytest.mark.django_db
    def test_link_and_unlink_entity(self, staff_client):
        doc = KnowledgeDocumentFactory.create()
        link_url = reverse(
            "api:v1:intelligence:intelligence-knowledge-link-entity",
            kwargs={"pk": str(doc.id)},
        )

        response = staff_client.post(
            link_url, {"entity_type": "shot", "entity_id": "shot-1"}, format="json"
        )

        assert response.status_code == 200
        links = response.json()["linked_entities"]
        assert len(links) == 1

        unlink_url = reverse(
            "api:v1:intelligence:intelligence-knowledge-unlink-entity",
            kwargs={"pk": str(doc.id), "link_id": links[0]["id"]},
        )
        response = staff_client.delete(unlink_url)

        assert response.status_code == 200
        assert response.json()["linked_entities"] == []
