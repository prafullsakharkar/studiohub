"""
Identity login attempt viewset tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import LoginAttemptFactory


class TestLoginAttemptViewSet:
    """Tests for LoginAttemptViewSet."""

    @pytest.mark.django_db
    def test_list_login_attempts_unauthenticated(self, api_client):
        """Test listing login attempts without authentication."""
        response = api_client.get(reverse("api:v1:identity:login-attempt-list"))
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_login_attempts_authenticated(self, authenticated_client):
        """Test listing login attempts with authentication."""
        response = authenticated_client.get(reverse("api:v1:identity:login-attempt-list"))
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_list_login_attempts_staff(self, staff_client):
        """Test listing login attempts with staff privileges."""
        response = staff_client.get(reverse("api:v1:identity:login-attempt-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_list_login_attempts_admin(self, admin_client):
        """Test listing login attempts with admin privileges."""
        response = admin_client.get(reverse("api:v1:identity:login-attempt-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_retrieve_login_attempt_unauthenticated(self, api_client):
        """Test retrieving login attempt without authentication."""
        attempt = LoginAttemptFactory.create()
        response = api_client.get(
            reverse("api:v1:identity:login-attempt-detail", kwargs={"pk": attempt.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_retrieve_login_attempt_staff(self, staff_client):
        """Test retrieving login attempt with staff privileges."""
        attempt = LoginAttemptFactory.create()
        response = staff_client.get(
            reverse("api:v1:identity:login-attempt-detail", kwargs={"pk": attempt.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_create_login_attempt_unauthenticated(self, api_client):
        """Test creating login attempt without authentication."""
        data = {
            "success": True,
        }
        response = api_client.post(reverse("api:v1:identity:login-attempt-list"), data)
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_create_login_attempt_staff(self, staff_client):
        """Test creating login attempt with staff privileges."""
        data = {
            "success": True,
            "ip_address": "192.168.1.1",
        }
        response = staff_client.post(reverse("api:v1:identity:login-attempt-list"), data)
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_update_login_attempt_unauthenticated(self, api_client):
        """Test updating login attempt without authentication."""
        attempt = LoginAttemptFactory.create()
        data = {"success": False}
        response = api_client.put(
            reverse("api:v1:identity:login-attempt-detail", kwargs={"pk": attempt.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_login_attempt_staff(self, staff_client):
        """Test updating login attempt with staff privileges."""
        attempt = LoginAttemptFactory.create()
        data = {"success": False}
        response = staff_client.patch(
            reverse("api:v1:identity:login-attempt-detail", kwargs={"pk": attempt.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_partial_update_login_attempt_unauthenticated(self, api_client):
        """Test partially updating login attempt without authentication."""
        attempt = LoginAttemptFactory.create()
        data = {"success": False}
        response = api_client.patch(
            reverse("api:v1:identity:login-attempt-detail", kwargs={"pk": attempt.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_partial_update_login_attempt_staff(self, staff_client):
        """Test partially updating login attempt with staff privileges."""
        attempt = LoginAttemptFactory.create()
        data = {"success": False}
        response = staff_client.patch(
            reverse("api:v1:identity:login-attempt-detail", kwargs={"pk": attempt.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_destroy_login_attempt_unauthenticated(self, api_client):
        """Test deleting login attempt without authentication."""
        attempt = LoginAttemptFactory.create()
        response = api_client.delete(
            reverse("api:v1:identity:login-attempt-detail", kwargs={"pk": attempt.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_destroy_login_attempt_staff(self, staff_client):
        """Test deleting login attempt with staff privileges."""
        attempt = LoginAttemptFactory.create()
        response = staff_client.delete(
            reverse("api:v1:identity:login-attempt-detail", kwargs={"pk": attempt.id})
        )
        assert response.status_code == 204
