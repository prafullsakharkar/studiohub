"""
Identity login attempt permissions tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import LoginAttemptFactory


class TestLoginAttemptPermissions:
    """Tests for LoginAttempt permissions."""

    @pytest.fixture(autouse=True)
    def _inject_api_client(self, api_client):
        """Expose the API client to tests using ``self.api_client``."""
        self.api_client = api_client

    @pytest.mark.django_db
    def test_anonymous_user_cannot_view_login_attempt_list(self):
        """Test that anonymous user cannot view login attempt list."""
        response = self.api_client.get("/api/v1/identity/login-attempts/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_view_login_attempt_list(self, authenticated_client):
        """Test that authenticated user cannot view login attempt list."""
        response = authenticated_client.get("/api/v1/identity/login-attempts/")
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_view_login_attempt_list(self, staff_client):
        """Test that staff user can view login attempt list."""
        response = staff_client.get("/api/v1/identity/login-attempts/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_view_login_attempt_list(self, admin_client):
        """Test that admin user can view login attempt list."""
        response = admin_client.get("/api/v1/identity/login-attempts/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_create_login_attempt(self):
        """Test that anonymous user cannot create login attempt."""
        response = self.api_client.post(
            "/api/v1/identity/login-attempts/",
            {"username": "test@example.com", "ip_address": "127.0.0.1", "success": True},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_create_login_attempt(self, authenticated_client):
        """Test that authenticated user cannot create login attempt."""
        response = authenticated_client.post(
            "/api/v1/identity/login-attempts/",
            {"username": "test@example.com", "ip_address": "127.0.0.1", "success": True},
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_create_login_attempt(self, staff_client):
        """Test that staff user can create login attempt."""
        response = staff_client.post(
            "/api/v1/identity/login-attempts/",
            {"username": "test@example.com", "ip_address": "127.0.0.1", "success": True},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_admin_user_can_create_login_attempt(self, admin_client):
        """Test that admin user can create login attempt."""
        response = admin_client.post(
            "/api/v1/identity/login-attempts/",
            {"username": "test@example.com", "ip_address": "127.0.0.1", "success": True},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_anonymous_user_cannot_update_login_attempt(self):
        """Test that anonymous user cannot update login attempt."""
        attempt = LoginAttemptFactory.create()
        response = self.api_client.patch(
            f"/api/v1/identity/login-attempts/{attempt.id}/",
            {"success": False},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_update_login_attempt(self, authenticated_client):
        """Test that authenticated user cannot update login attempt."""
        attempt = LoginAttemptFactory.create()
        response = authenticated_client.patch(
            f"/api/v1/identity/login-attempts/{attempt.id}/",
            {"success": False},
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_update_login_attempt(self, staff_client):
        """Test that staff user can update login attempt."""
        attempt = LoginAttemptFactory.create()
        response = staff_client.patch(
            f"/api/v1/identity/login-attempts/{attempt.id}/",
            {"success": False},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_update_login_attempt(self, admin_client):
        """Test that admin user can update login attempt."""
        attempt = LoginAttemptFactory.create()
        response = admin_client.patch(
            f"/api/v1/identity/login-attempts/{attempt.id}/",
            {"success": False},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_delete_login_attempt(self):
        """Test that anonymous user cannot delete login attempt."""
        attempt = LoginAttemptFactory.create()
        response = self.api_client.delete(f"/api/v1/identity/login-attempts/{attempt.id}/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_delete_login_attempt(self, authenticated_client):
        """Test that authenticated user cannot delete login attempt."""
        attempt = LoginAttemptFactory.create()
        response = authenticated_client.delete(
            f"/api/v1/identity/login-attempts/{attempt.id}/"
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_delete_login_attempt(self, staff_client):
        """Test that staff user can delete login attempt."""
        attempt = LoginAttemptFactory.create()
        response = staff_client.delete(f"/api/v1/identity/login-attempts/{attempt.id}/")
        assert response.status_code == 204

    @pytest.mark.django_db
    def test_admin_user_can_delete_login_attempt(self, admin_client):
        """Test that admin user can delete login attempt."""
        attempt = LoginAttemptFactory.create()
        response = admin_client.delete(f"/api/v1/identity/login-attempts/{attempt.id}/")
        assert response.status_code == 204
