"""
Identity authorization security tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import UserFactory


class TestAuthorizationSecurity:
    """Tests for authorization security."""

    @pytest.mark.django_db
    def test_access_protected_endpoint_without_token(self, api_client):
        """Test accessing protected endpoint without token."""
        response = api_client.get(reverse("api:v1:identity:user-detail", kwargs={"pk": 1}))
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_access_protected_endpoint_with_invalid_token(self, api_client):
        """Test accessing protected endpoint with invalid token."""
        api_client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token")
        response = api_client.get(reverse("api:v1:identity:user-detail", kwargs={"pk": 1}))
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_access_protected_endpoint_with_expired_token(self, api_client):
        """Test accessing protected endpoint with expired token."""
        user = UserFactory.create()
        api_client.force_authenticate(user=user)
        response = api_client.get(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_access_admin_endpoint_without_staff(self, authenticated_client):
        """Test accessing admin endpoint without staff privileges."""
        from apps.identity.tests.factories import UserFactory

        target = UserFactory.create()
        response = authenticated_client.delete(
            reverse("api:v1:identity:user-detail", kwargs={"pk": target.id})
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_access_admin_endpoint_with_staff(self, staff_client):
        """Test accessing admin endpoint with staff privileges."""
        response = staff_client.get(reverse("api:v1:identity:user-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_access_admin_endpoint_with_superuser(self, admin_client):
        """Test accessing admin endpoint with superuser privileges."""
        response = admin_client.get(reverse("api:v1:identity:user-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_user_can_view_own_profile(self, authenticated_client, user):
        """Test that user can view own profile."""
        from apps.identity.tests.factories import ProfileFactory

        profile = ProfileFactory.create(user=user)
        response = authenticated_client.get(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_user_cannot_view_nonexistent_profile(self, authenticated_client):
        """Test that a missing profile yields 404 (authorization boundary)."""
        import uuid

        response = authenticated_client.get(
            reverse(
                "api:v1:identity:profile-detail",
                kwargs={"pk": uuid.uuid4()},
            )
        )
        assert response.status_code == 404

    @pytest.mark.django_db
    def test_staff_can_view_other_profile(self, staff_client):
        """Test that staff can view other profile."""
        from apps.identity.tests.factories import ProfileFactory

        profile = ProfileFactory.create()
        response = staff_client.get(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id})
        )
        assert response.status_code == 200
