"""
Identity user viewset tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.models.user import User
from apps.identity.tests.factories import UserFactory


class TestUserViewSet:
    """Tests for UserViewSet."""

    @pytest.mark.django_db
    def test_list_users_unauthenticated(self, api_client):
        """Test listing users without authentication."""
        response = api_client.get(reverse("api:v1:identity:user-list"))
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_users_authenticated(self, authenticated_client):
        """Test listing users with authentication."""
        response = authenticated_client.get(reverse("api:v1:identity:user-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_list_users_staff(self, staff_client):
        """Test listing users with staff privileges."""
        response = staff_client.get(reverse("api:v1:identity:user-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_list_users_admin(self, admin_client):
        """Test listing users with admin privileges."""
        response = admin_client.get(reverse("api:v1:identity:user-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_retrieve_user_unauthenticated(self, api_client):
        """Test retrieving user without authentication."""
        user = UserFactory.create()
        response = api_client.get(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_retrieve_user_authenticated(self, authenticated_client):
        """Test retrieving user with authentication."""
        user = UserFactory.create()
        response = authenticated_client.get(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_create_user_unauthenticated(self, api_client):
        """Test creating user without authentication."""
        data = {
            "email": "new@example.com",
            "password": "Password123!",
        }
        response = api_client.post(reverse("api:v1:identity:user-list"), data)
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_create_user_authenticated(self, authenticated_client):
        """Test creating user with authentication."""
        data = {
            "email": "new@example.com",
            "password": "Password123!",
        }
        response = authenticated_client.post(reverse("api:v1:identity:user-list"), data)
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_create_user_staff(self, staff_client):
        """Test creating user with staff privileges."""
        data = {
            "email": "new@example.com",
            "password": "Password123!",
        }
        response = staff_client.post(reverse("api:v1:identity:user-list"), data)
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_create_user_admin(self, admin_client):
        """Test creating user with admin privileges."""
        data = {
            "email": "new@example.com",
            "password": "Password123!",
        }
        response = admin_client.post(reverse("api:v1:identity:user-list"), data)
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_update_user_unauthenticated(self, api_client):
        """Test updating user without authentication."""
        user = UserFactory.create()
        data = {"email": "updated@example.com"}
        response = api_client.put(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_user_authenticated(self, authenticated_client):
        """Test updating user with authentication."""
        user = UserFactory.create()
        data = {"email": "updated@example.com"}
        response = authenticated_client.put(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id}), data
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_update_user_staff(self, staff_client):
        """Test updating user with staff privileges."""
        user = UserFactory.create()
        data = {"email": "updated@example.com"}
        response = staff_client.put(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_update_user_admin(self, admin_client):
        """Test updating user with admin privileges."""
        user = UserFactory.create()
        data = {"email": "updated@example.com"}
        response = admin_client.put(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_partial_update_user_unauthenticated(self, api_client):
        """Test partially updating user without authentication."""
        user = UserFactory.create()
        data = {"email": "updated@example.com"}
        response = api_client.patch(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_partial_update_user_authenticated(self, authenticated_client):
        """Test partially updating user with authentication."""
        user = UserFactory.create()
        data = {"email": "updated@example.com"}
        response = authenticated_client.patch(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id}), data
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_partial_update_user_staff(self, staff_client):
        """Test partially updating user with staff privileges."""
        user = UserFactory.create()
        data = {"email": "updated@example.com"}
        response = staff_client.patch(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_partial_update_user_admin(self, admin_client):
        """Test partially updating user with admin privileges."""
        user = UserFactory.create()
        data = {"email": "updated@example.com"}
        response = admin_client.patch(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_destroy_user_unauthenticated(self, api_client):
        """Test deleting user without authentication."""
        user = UserFactory.create()
        response = api_client.delete(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_destroy_user_authenticated(self, authenticated_client):
        """Test deleting user with authentication."""
        user = UserFactory.create()
        response = authenticated_client.delete(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id})
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_destroy_user_staff(self, staff_client):
        """Test deleting user with staff privileges."""
        user = UserFactory.create()
        response = staff_client.delete(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id})
        )
        assert response.status_code == 204

    @pytest.mark.django_db
    def test_destroy_user_admin(self, admin_client):
        """Test deleting user with admin privileges."""
        user = UserFactory.create()
        response = admin_client.delete(
            reverse("api:v1:identity:user-detail", kwargs={"pk": user.id})
        )
        assert response.status_code == 204

    @pytest.mark.django_db
    def test_search_users(self, admin_client):
        """Test filtering users by email search."""
        UserFactory.create(email="john@example.com")
        UserFactory.create(email="jane@example.com")

        response = admin_client.get(reverse("api:v1:identity:user-list"), {"email": "john"})
        assert response.status_code == 200
        assert [u["email"] for u in response.data] == ["john@example.com"]

    @pytest.mark.django_db
    def test_order_users(self, admin_client):
        """Test ordering users."""
        UserFactory.create(email="z@example.com")
        UserFactory.create(email="a@example.com")

        response = admin_client.get(
            reverse("api:v1:identity:user-list"), {"ordering": "email"}
        )
        assert response.status_code == 200
        emails = [u["email"] for u in response.data]
        assert emails.index("a@example.com") < emails.index("z@example.com")

    @pytest.mark.django_db
    def test_filter_users_by_is_active(self, admin_client):
        """Test filtering users by is_active."""
        UserFactory.create(is_active=True)
        UserFactory.create(is_active=False)

        response = admin_client.get(reverse("api:v1:identity:user-list"), {"is_active": True})
        assert response.status_code == 200
        assert all(u["is_active"] for u in response.data)

        active_user = UserFactory.create(is_active=True, email="active@example.com")
        response = admin_client.get(
            reverse("api:v1:identity:user-list"), {"email": "active@example.com"}
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(active_user.id)

    @pytest.mark.django_db
    def test_filter_users_by_is_staff(self, admin_client):
        """Test filtering users by is_staff."""
        UserFactory.create(is_staff=True)
        UserFactory.create(is_staff=False)

        response = admin_client.get(reverse("api:v1:identity:user-list"), {"is_staff": True})
        assert response.status_code == 200
        assert all(u["is_staff"] for u in response.data)
