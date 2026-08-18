"""
Core attachment viewset tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.core.api.viewsets.attachment import AttachmentViewSet
from apps.core.models.attachment import Attachment
from apps.core.tests.factories import AttachmentFactory


class TestAttachmentViewSet:
    """Tests for AttachmentViewSet."""

    @pytest.mark.django_db
    def test_list_attachments(self, authenticated_client):
        """Test listing attachments."""
        AttachmentFactory.create_batch(3)

        url = reverse("api:v1:core:attachment-list")
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
    def test_list_attachments_unauthenticated(self, api_client):
        """Test listing attachments without authentication."""
        AttachmentFactory.create_batch(3)

        url = reverse("api:v1:core:attachment-list")
        response = api_client.get(url)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_attachments_with_pagination(self, authenticated_client):
        """Test listing attachments with pagination."""
        AttachmentFactory.create_batch(15)

        url = reverse("api:v1:core:attachment-list")
        response = authenticated_client.get(url, {"page_size": 5, "page": 1})

        assert response.status_code == 200

        data = response.json()

        assert data["meta"]["pagination"]["total"] == 15
        assert len(data["data"]) == 5
        assert "next_url" in data["meta"]["pagination"]

    @pytest.mark.django_db
    def test_retrieve_attachment(self, authenticated_client):
        """Test retrieving a single attachment."""
        attachment = AttachmentFactory.create()

        url = reverse("api:v1:core:attachment-detail", kwargs={"uuid": attachment.uuid})
        response = authenticated_client.get(url)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["data"]["id"] == str(attachment.id)
        assert data["data"]["uuid"] == str(attachment.uuid)
        assert data["data"]["name"] == attachment.name

    @pytest.mark.django_db
    def test_retrieve_attachment_not_found(self, authenticated_client):
        """Test retrieving a non-existent attachment."""
        from uuid import uuid4

        url = reverse("api:v1:core:attachment-detail", kwargs={"uuid": uuid4()})
        response = authenticated_client.get(url)

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_create_attachment(self, authenticated_client):
        """Test creating an attachment."""
        url = reverse("api:v1:core:attachment-list")
        data = {
            "name": "New Attachment",
            "description": "A new attachment",
            "file_type": "document",
            "mime_type": "text/plain",
            "file_size": 1024,
        }
        response = authenticated_client.post(url, data)

        assert response.status_code == 201
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["data"]["name"] == "New Attachment"
        assert data["data"]["description"] == "A new attachment"
        assert data["data"]["file_type"] == "document"

    @pytest.mark.django_db
    def test_create_attachment_unauthenticated(self, api_client):
        """Test creating an attachment without authentication."""
        url = reverse("api:v1:core:attachment-list")
        data = {
            "name": "New Attachment",
            "description": "A new attachment",
            "file_type": "document",
            "mime_type": "text/plain",
            "file_size": 1024,
        }
        response = api_client.post(url, data)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_attachment(self, authenticated_client):
        """Test updating an attachment."""
        attachment = AttachmentFactory.create()

        url = reverse("api:v1:core:attachment-detail", kwargs={"uuid": attachment.uuid})
        data = {
            "name": "Updated Attachment",
            "description": "An updated attachment",
            "file_type": "image",
        }
        response = authenticated_client.put(url, data)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["data"]["name"] == "Updated Attachment"
        assert data["data"]["description"] == "An updated attachment"
        assert data["data"]["file_type"] == "image"

    @pytest.mark.django_db
    def test_partial_update_attachment(self, authenticated_client):
        """Test partially updating an attachment."""
        attachment = AttachmentFactory.create()

        url = reverse("api:v1:core:attachment-detail", kwargs={"uuid": attachment.uuid})
        data = {
            "description": "A partially updated attachment",
        }
        response = authenticated_client.patch(url, data)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert data["data"]["description"] == "A partially updated attachment"

    @pytest.mark.django_db
    def test_delete_attachment(self, authenticated_client):
        """Test deleting an attachment."""
        attachment = AttachmentFactory.create()

        url = reverse("api:v1:core:attachment-detail", kwargs={"uuid": attachment.uuid})
        response = authenticated_client.delete(url)

        assert response.status_code == 204

        # Verify soft delete (use all_objects since the default manager
        # excludes soft-deleted records)
        attachment = Attachment.all_objects.get(pk=attachment.pk)
        assert attachment.is_deleted is True

    @pytest.mark.django_db
    def test_search_attachments(self, authenticated_client):
        """Test searching attachments."""
        AttachmentFactory.create_batch(3, name="Search Attachment")
        AttachmentFactory.create_batch(2, name="Other Attachment")

        url = reverse("api:v1:core:attachment-list")
        response = authenticated_client.get(url, {"search": "Search"})

        assert response.status_code == 200

        data = response.json()

        assert data["meta"]["pagination"]["total"] == 3

    @pytest.mark.django_db
    def test_order_attachments(self, authenticated_client):
        """Test ordering attachments."""
        AttachmentFactory.create_batch(3)

        url = reverse("api:v1:core:attachment-list")
        response = authenticated_client.get(url, {"ordering": "name"})

        assert response.status_code == 200

        data = response.json()

        assert data["meta"]["pagination"]["total"] == 3

    @pytest.mark.django_db
    def test_filter_attachments(self, authenticated_client):
        """Test filtering attachments."""
        AttachmentFactory.create_batch(3, file_type="document")
        AttachmentFactory.create_batch(2, file_type="image")

        url = reverse("api:v1:core:attachment-list")
        response = authenticated_client.get(url, {"file_type": "document"})

        assert response.status_code == 200

        data = response.json()

        assert data["meta"]["pagination"]["total"] == 3
