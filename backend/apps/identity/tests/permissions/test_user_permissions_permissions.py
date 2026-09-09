"""
Identity user permissions tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory


class TestUserPermissions:
    """Tests for User permissions."""

    @pytest.fixture(autouse=True)
    def _inject_api_client(self, api_client):
        """Expose the API client to tests using ``self.api_client``."""
        self.api_client = api_client

    @pytest.mark.django_db
    def test_anonymous_user_cannot_view_user_list(self):
        """Test that anonymous user cannot view user list."""
        response = self.api_client.get("/api/v1/identity/users/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_can_view_user_list(self, authenticated_client):
        """Test that authenticated user can view user list."""
        response = authenticated_client.get("/api/v1/identity/users/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_staff_user_can_view_user_list(self, staff_client):
        """Test that staff user can view user list."""
        response = staff_client.get("/api/v1/identity/users/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_view_user_list(self, admin_client):
        """Test that admin user can view user list."""
        response = admin_client.get("/api/v1/identity/users/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_create_user(self):
        """Test that anonymous user cannot create user."""
        response = self.api_client.post(
            "/api/v1/identity/users/",
            {"email": "new@example.com", "password": "Password123!"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_create_user(self, authenticated_client):
        """Test that authenticated user cannot create user."""
        response = authenticated_client.post(
            "/api/v1/identity/users/",
            {"email": "new@example.com", "password": "Password123!"},
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_create_user(self, staff_client):
        """Test that staff user can create user."""
        response = staff_client.post(
            "/api/v1/identity/users/",
            {"email": "new@example.com", "password": "Password123!"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_admin_user_can_create_user(self, admin_client):
        """Test that admin user can create user."""
        response = admin_client.post(
            "/api/v1/identity/users/",
            {"email": "new@example.com", "password": "Password123!"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_anonymous_user_cannot_update_user(self):
        """Test that anonymous user cannot update user."""
        user = UserFactory.create()
        response = self.api_client.patch(
            f"/api/v1/identity/users/{user.id}/",
            {"email": "updated@example.com"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_update_other_user(self, authenticated_client):
        """Test that authenticated user cannot update other user."""
        user = UserFactory.create()
        response = authenticated_client.patch(
            f"/api/v1/identity/users/{user.id}/",
            {"email": "updated@example.com"},
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_update_user(self, staff_client):
        """Test that staff user can update user."""
        user = UserFactory.create()
        response = staff_client.patch(
            f"/api/v1/identity/users/{user.id}/",
            {"email": "updated@example.com"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_update_user(self, admin_client):
        """Test that admin user can update user."""
        user = UserFactory.create()
        response = admin_client.patch(
            f"/api/v1/identity/users/{user.id}/",
            {"email": "updated@example.com"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_delete_user(self):
        """Test that anonymous user cannot delete user."""
        user = UserFactory.create()
        response = self.api_client.delete(f"/api/v1/identity/users/{user.id}/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_delete_other_user(self, authenticated_client):
        """Test that authenticated user cannot delete other user."""
        user = UserFactory.create()
        response = authenticated_client.delete(f"/api/v1/identity/users/{user.id}/")
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_delete_user(self, staff_client):
        """Test that staff user can delete user."""
        user = UserFactory.create()
        response = staff_client.delete(f"/api/v1/identity/users/{user.id}/")
        assert response.status_code == 204

    @pytest.mark.django_db
    def test_admin_user_can_delete_user(self, admin_client):
        """Test that admin user can delete user."""
        user = UserFactory.create()
        response = admin_client.delete(f"/api/v1/identity/users/{user.id}/")
        assert response.status_code == 204
