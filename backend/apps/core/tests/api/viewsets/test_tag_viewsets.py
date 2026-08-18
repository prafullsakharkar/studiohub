"""
Core tag viewset tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.core.api.viewsets.tag import TagViewSet
from apps.core.models.tag import Tag
from apps.core.tests.factories import TagFactory


class TestTagViewSet:
    """Tests for TagViewSet."""

    @pytest.mark.django_db
    def test_list_tags(self, authenticated_client):
        """Test listing tags."""
        TagFactory.create_batch(3)

        url = reverse("api:v1:core:tag-list")
        response = authenticated_client.get(url)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["success"] is True
        assert "data" in data
        assert "meta" in data
        assert "pagination" in data["meta"]

        assert data["meta"]["pagination"]["total"] == 3
        assert len(data["data"]) == 3

    @pytest.mark.django_db
    def test_list_tags_unauthenticated(self, api_client):
        """Test listing tags without authentication."""
        TagFactory.create_batch(3)

        url = reverse("api:v1:core:tag-list")
        response = api_client.get(url)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_tags_with_pagination(self, authenticated_client):
        """Test listing tags with pagination."""
        TagFactory.create_batch(15)

        url = reverse("api:v1:core:tag-list")
        response = authenticated_client.get(url, {"page_size": 5, "page": 1})

        assert response.status_code == 200

        data = response.json()

        assert data["meta"]["pagination"]["total"] == 15
        assert len(data["data"]) == 5
        assert "next_url" in data["meta"]["pagination"]

    @pytest.mark.django_db
    def test_retrieve_tag(self, authenticated_client):
        """Test retrieving a single tag."""
        tag = TagFactory.create()

        url = reverse("api:v1:core:tag-detail", kwargs={"uuid": tag.uuid})
        response = authenticated_client.get(url)

        print(f"Response status: {response.status_code}")
        print(f"Response content: {response.content}")

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["data"]["id"] == str(tag.id)
        assert data["data"]["uuid"] == str(tag.uuid)
        assert data["data"]["name"] == tag.name

    @pytest.mark.django_db
    def test_retrieve_tag_not_found(self, authenticated_client):
        """Test retrieving a non-existent tag."""
        from uuid import uuid4

        url = reverse("api:v1:core:tag-detail", kwargs={"uuid": uuid4()})
        response = authenticated_client.get(url)

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_create_tag(self, authenticated_client):
        """Test creating a tag."""
        url = reverse("api:v1:core:tag-list")
        data = {
            "name": "New Tag",
            "description": "A new tag",
            "color": "#ff0000",
        }
        response = authenticated_client.post(url, data)

        assert response.status_code == 201
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["data"]["name"] == "New Tag"
        assert data["data"]["description"] == "A new tag"
        assert data["data"]["color"] == "#ff0000"

    @pytest.mark.django_db
    def test_create_tag_unauthenticated(self, api_client):
        """Test creating a tag without authentication."""
        url = reverse("api:v1:core:tag-list")
        data = {
            "name": "New Tag",
            "description": "A new tag",
            "color": "#ff0000",
        }
        response = api_client.post(url, data)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_tag(self, authenticated_client):
        """Test updating a tag."""
        tag = TagFactory.create()

        url = reverse("api:v1:core:tag-detail", kwargs={"uuid": tag.uuid})
        data = {
            "name": "Updated Tag",
            "description": "An updated tag",
            "color": "#00ff00",
        }
        response = authenticated_client.put(url, data)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["data"]["name"] == "Updated Tag"
        assert data["data"]["description"] == "An updated tag"
        assert data["data"]["color"] == "#00ff00"

    @pytest.mark.django_db
    def test_partial_update_tag(self, authenticated_client):
        """Test partially updating a tag."""
        tag = TagFactory.create()

        url = reverse("api:v1:core:tag-detail", kwargs={"uuid": tag.uuid})
        data = {
            "description": "A partially updated tag",
        }
        response = authenticated_client.patch(url, data)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["data"]["description"] == "A partially updated tag"

    @pytest.mark.django_db
    def test_delete_tag(self, authenticated_client):
        """Test deleting a tag."""
        tag = TagFactory.create()

        url = reverse("api:v1:core:tag-detail", kwargs={"uuid": tag.uuid})
        response = authenticated_client.delete(url)

        assert response.status_code == 204

        # Verify soft delete (use all_objects since the default manager
        # excludes soft-deleted records)
        tag = Tag.all_objects.get(pk=tag.pk)
        assert tag.is_deleted is True

    @pytest.mark.django_db
    def test_search_tags(self, authenticated_client):
        """Test searching tags."""
        # Use unique names: TagFactory uses get_or_create on name.
        for i in range(3):
            TagFactory.create(name=f"Search Tag {i}")
        for i in range(2):
            TagFactory.create(name=f"Other Tag {i}")

        url = reverse("api:v1:core:tag-list")
        response = authenticated_client.get(url, {"search": "Search"})

        assert response.status_code == 200

        data = response.json()

        assert data["meta"]["pagination"]["total"] == 3

    @pytest.mark.django_db
    def test_order_tags(self, authenticated_client):
        """Test ordering tags."""
        TagFactory.create_batch(3)

        url = reverse("api:v1:core:tag-list")
        response = authenticated_client.get(url, {"ordering": "name"})

        assert response.status_code == 200

        data = response.json()

        assert data["meta"]["pagination"]["total"] == 3

    @pytest.mark.django_db
    def test_filter_tags(self, authenticated_client):
        """Test filtering tags."""
        TagFactory.create_batch(3, is_system=False)
        TagFactory.create_batch(2, is_system=True)

        url = reverse("api:v1:core:tag-list")
        response = authenticated_client.get(url, {"is_system": "false"})

        assert response.status_code == 200

        data = response.json()

        assert data["meta"]["pagination"]["total"] == 3
