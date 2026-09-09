"""
Identity authentication security tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import UserFactory


class TestAuthenticationSecurity:
    """Tests for authentication security."""

    @pytest.mark.django_db
    def test_login_with_valid_credentials(self, api_client):
        """Test login with valid credentials."""
        user = UserFactory.create(password="Password123!")
        user.set_password("Password123!")
        user.save()

        response = api_client.post(
            reverse("api:v1:identity:login"),
            {"email": user.email, "password": "Password123!"},
        )
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    @pytest.mark.django_db
    def test_login_with_invalid_credentials(self, api_client):
        """Test login with invalid credentials."""
        user = UserFactory.create(password="Password123!")
        user.set_password("Password123!")
        user.save()

        response = api_client.post(
            reverse("api:v1:identity:login"),
            {"email": user.email, "password": "WrongPassword"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_login_with_nonexistent_user(self, api_client):
        """Test login with nonexistent user."""
        response = api_client.post(
            reverse("api:v1:identity:login"),
            {"email": "nonexistent@example.com", "password": "Password123!"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_login_with_empty_credentials(self, api_client):
        """Test login with empty credentials."""
        response = api_client.post(
            reverse("api:v1:identity:login"),
            {"email": "", "password": ""},
        )
        assert response.status_code == 400

    @pytest.mark.django_db
    def test_login_with_missing_email(self, api_client):
        """Test login with missing email."""
        response = api_client.post(
            reverse("api:v1:identity:login"),
            {"password": "Password123!"},
        )
        assert response.status_code == 400

    @pytest.mark.django_db
    def test_login_with_missing_password(self, api_client):
        """Test login with missing password."""
        response = api_client.post(
            reverse("api:v1:identity:login"),
            {"email": "test@example.com"},
        )
        assert response.status_code == 400

    @pytest.mark.django_db
    def test_login_with_inactive_user(self, api_client):
        """Test login with inactive user."""
        user = UserFactory.create(password="Password123!", is_active=False)
        user.set_password("Password123!")
        user.save()

        response = api_client.post(
            reverse("api:v1:identity:login"),
            {"email": user.email, "password": "Password123!"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_logout_success(self, authenticated_client):
        """Test successful logout."""
        response = authenticated_client.post(reverse("api:v1:identity:logout"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_logout_without_token(self, api_client):
        """Test logout without token."""
        response = api_client.post(reverse("api:v1:identity:logout"))
        assert response.status_code == 401
