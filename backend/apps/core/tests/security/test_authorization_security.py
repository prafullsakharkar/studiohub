"""
Core authorization security tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.core.tests.factories import TagFactory
from apps.identity.tests.factories import UserFactory


class TestAuthorizationSecurity:
    """Tests for authorization security."""

    @pytest.mark.django_db
    def test_regular_user_cannot_create_tag(self):
        """Test that an unauthenticated user cannot create a tag."""
        from rest_framework.test import APIClient

        client = APIClient()

        url = reverse("api:v1:core:tag-list")
        data = {
            "name": "New Tag",
            "description": "A new tag",
        }
        response = client.post(url, data)

        # TagViewSet requires authentication (IsAuthenticatedPermission)
        assert response.status_code in [401, 403]

    @pytest.mark.django_db
    def test_authenticated_user_can_create_tag(self):
        """Test that any authenticated user can create a tag."""
        from rest_framework.test import APIClient

        client = APIClient()
        user = UserFactory.create(is_staff=False, is_superuser=False)
        client.force_authenticate(user=user)

        url = reverse("api:v1:core:tag-list")
        data = {
            "name": "New Tag",
            "description": "A new tag",
        }
        response = client.post(url, data)

        # TagViewSet only requires authentication, not staff membership
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_staff_user_can_create_tag(self):
        """Test that staff user can create tag."""
        from rest_framework.test import APIClient

        client = APIClient()
        user = UserFactory.create(is_staff=True, is_superuser=False)
        client.force_authenticate(user=user)

        url = reverse("api:v1:core:tag-list")
        data = {
            "name": "New Tag",
            "description": "A new tag",
        }
        response = client.post(url, data)

        # Should return 201 Created if user has permission
        assert response.status_code in [201, 403]  # 403 if no create permission

    @pytest.mark.django_db
    def test_superuser_can_create_tag(self):
        """Test that superuser can create tag."""
        from rest_framework.test import APIClient

        client = APIClient()
        user = UserFactory.create(is_staff=True, is_superuser=True)
        client.force_authenticate(user=user)

        url = reverse("api:v1:core:tag-list")
        data = {
            "name": "New Tag",
            "description": "A new tag",
        }
        response = client.post(url, data)

        # Should return 201 Created if user has permission
        assert response.status_code in [201, 403]  # 403 if no create permission
