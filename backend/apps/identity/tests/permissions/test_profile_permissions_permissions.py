"""
Identity profile permissions tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import ProfileFactory


class TestProfilePermissions:
    """Tests for Profile permissions."""

    @pytest.fixture(autouse=True)
    def _inject_api_client(self, api_client):
        """Expose the API client to tests using ``self.api_client``."""
        self.api_client = api_client

    @pytest.mark.django_db
    def test_anonymous_user_cannot_view_profile_list(self):
        """Test that anonymous user cannot view profile list."""
        response = self.api_client.get("/api/v1/identity/profiles/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_can_view_profile_list(self, authenticated_client):
        """Test that authenticated user can view profile list."""
        response = authenticated_client.get("/api/v1/identity/profiles/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_staff_user_can_view_profile_list(self, staff_client):
        """Test that staff user can view profile list."""
        response = staff_client.get("/api/v1/identity/profiles/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_view_profile_list(self, admin_client):
        """Test that admin user can view profile list."""
        response = admin_client.get("/api/v1/identity/profiles/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_create_profile(self):
        """Test that anonymous user cannot create profile."""
        response = self.api_client.post(
            "/api/v1/identity/profiles/",
            {"first_name": "John", "last_name": "Doe"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_can_create_profile(self, authenticated_client):
        """Test that authenticated user can create profile."""
        response = authenticated_client.post(
            "/api/v1/identity/profiles/",
            {"first_name": "John", "last_name": "Doe"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_staff_user_can_create_profile(self, staff_client):
        """Test that staff user can create profile."""
        response = staff_client.post(
            "/api/v1/identity/profiles/",
            {"first_name": "John", "last_name": "Doe"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_admin_user_can_create_profile(self, admin_client):
        """Test that admin user can create profile."""
        response = admin_client.post(
            "/api/v1/identity/profiles/",
            {"first_name": "John", "last_name": "Doe"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_anonymous_user_cannot_update_profile(self):
        """Test that anonymous user cannot update profile."""
        profile = ProfileFactory.create()
        response = self.api_client.patch(
            f"/api/v1/identity/profiles/{profile.id}/",
            {"first_name": "Updated"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_can_update_own_profile(self, authenticated_client):
        """Test that authenticated user can update own profile."""
        profile = ProfileFactory.create()
        response = authenticated_client.patch(
            f"/api/v1/identity/profiles/{profile.id}/",
            {"first_name": "Updated"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_staff_user_can_update_profile(self, staff_client):
        """Test that staff user can update profile."""
        profile = ProfileFactory.create()
        response = staff_client.patch(
            f"/api/v1/identity/profiles/{profile.id}/",
            {"first_name": "Updated"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_update_profile(self, admin_client):
        """Test that admin user can update profile."""
        profile = ProfileFactory.create()
        response = admin_client.patch(
            f"/api/v1/identity/profiles/{profile.id}/",
            {"first_name": "Updated"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_delete_profile(self):
        """Test that anonymous user cannot delete profile."""
        profile = ProfileFactory.create()
        response = self.api_client.delete(f"/api/v1/identity/profiles/{profile.id}/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_delete_other_profile(self, authenticated_client):
        """Test that authenticated user cannot delete other profile."""
        profile = ProfileFactory.create()
        response = authenticated_client.delete(f"/api/v1/identity/profiles/{profile.id}/")
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_delete_profile(self, staff_client):
        """Test that staff user can delete profile."""
        profile = ProfileFactory.create()
        response = staff_client.delete(f"/api/v1/identity/profiles/{profile.id}/")
        assert response.status_code == 204

    @pytest.mark.django_db
    def test_admin_user_can_delete_profile(self, admin_client):
        """Test that admin user can delete profile."""
        profile = ProfileFactory.create()
        response = admin_client.delete(f"/api/v1/identity/profiles/{profile.id}/")
        assert response.status_code == 204
