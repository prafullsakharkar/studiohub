"""
Identity profile viewset tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import ProfileFactory


class TestProfileViewSet:
    """Tests for ProfileViewSet."""

    @pytest.mark.django_db
    def test_list_profiles_unauthenticated(self, api_client):
        """Test listing profiles without authentication."""
        response = api_client.get(reverse("api:v1:identity:profile-list"))
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_profiles_authenticated(self, authenticated_client):
        """Test listing profiles with authentication."""
        response = authenticated_client.get(reverse("api:v1:identity:profile-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_list_profiles_scoped_to_self(self, authenticated_client, user):
        """Test listing profiles returns only the request user's own."""
        ProfileFactory.create(user=user)
        ProfileFactory.create()
        response = authenticated_client.get(reverse("api:v1:identity:profile-list"))
        assert response.status_code == 200
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        assert len(results) == 1

    @pytest.mark.django_db
    def test_retrieve_profile_unauthenticated(self, api_client):
        """Test retrieving profile without authentication."""
        profile = ProfileFactory.create()
        response = api_client.get(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_retrieve_profile_authenticated(self, authenticated_client, user):
        """Test retrieving own profile with authentication."""
        profile = ProfileFactory.create(user=user)
        response = authenticated_client.get(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_retrieve_other_users_profile_not_found(
        self, authenticated_client
    ):
        """Test retrieving another user's profile is scoped out."""
        profile = ProfileFactory.create()
        response = authenticated_client.get(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id})
        )
        assert response.status_code == 404

    @pytest.mark.django_db
    def test_retrieve_profile_staff_sees_all(self, staff_client):
        """Test staff can retrieve any profile."""
        profile = ProfileFactory.create()
        response = staff_client.get(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_create_profile_unauthenticated(self, api_client):
        """Test creating profile without authentication."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
        }
        response = api_client.post(reverse("api:v1:identity:profile-list"), data)
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_create_profile_authenticated(self, authenticated_client):
        """Test creating profile with authentication."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
        }
        response = authenticated_client.post(reverse("api:v1:identity:profile-list"), data)
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_update_profile_unauthenticated(self, api_client):
        """Test updating profile without authentication."""
        profile = ProfileFactory.create()
        data = {"first_name": "Updated"}
        response = api_client.put(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_profile_authenticated(self, authenticated_client, user):
        """Test updating own profile with authentication."""
        profile = ProfileFactory.create(user=user)
        data = {"first_name": "Updated"}
        response = authenticated_client.put(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_update_other_users_profile_not_found(self, authenticated_client):
        """Test updating another user's profile is scoped out."""
        profile = ProfileFactory.create()
        data = {"first_name": "Updated"}
        response = authenticated_client.put(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id}), data
        )
        assert response.status_code == 404

    @pytest.mark.django_db
    def test_partial_update_profile_unauthenticated(self, api_client):
        """Test partially updating profile without authentication."""
        profile = ProfileFactory.create()
        data = {"first_name": "Updated"}
        response = api_client.patch(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_partial_update_profile_authenticated(self, authenticated_client, user):
        """Test partially updating own profile with authentication."""
        profile = ProfileFactory.create(user=user)
        data = {"first_name": "Updated"}
        response = authenticated_client.patch(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_destroy_profile_unauthenticated(self, api_client):
        """Test deleting profile without authentication."""
        profile = ProfileFactory.create()
        response = api_client.delete(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_destroy_profile_authenticated(self, authenticated_client):
        """Test deleting profile with authentication."""
        profile = ProfileFactory.create()
        response = authenticated_client.delete(
            reverse("api:v1:identity:profile-detail", kwargs={"pk": profile.id})
        )
        assert response.status_code == 403
