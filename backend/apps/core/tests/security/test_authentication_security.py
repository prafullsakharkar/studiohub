"""
Core authentication security tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.core.tests.factories import TagFactory


class TestAuthenticationSecurity:
    """Tests for authentication security."""

    @pytest.mark.django_db
    def test_tag_list_requires_authentication(self):
        """Test that tag list endpoint requires authentication."""
        from rest_framework.test import APIClient

        client = APIClient()

        url = reverse("api:v1:core:tag-list")
        response = client.get(url)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_tag_create_requires_authentication(self):
        """Test that tag create endpoint requires authentication."""
        from rest_framework.test import APIClient

        client = APIClient()

        url = reverse("api:v1:core:tag-list")
        data = {
            "name": "New Tag",
            "description": "A new tag",
        }
        response = client.post(url, data)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_tag_update_requires_authentication(self):
        """Test that tag update endpoint requires authentication."""
        from rest_framework.test import APIClient

        client = APIClient()
        tag = TagFactory.create()

        url = reverse("api:v1:core:tag-detail", kwargs={"uuid": tag.uuid})
        data = {
            "name": "Updated Tag",
        }
        response = client.put(url, data)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_tag_delete_requires_authentication(self):
        """Test that tag delete endpoint requires authentication."""
        from rest_framework.test import APIClient

        client = APIClient()
        tag = TagFactory.create()

        url = reverse("api:v1:core:tag-detail", kwargs={"uuid": tag.uuid})
        response = client.delete(url)

        assert response.status_code == 401
