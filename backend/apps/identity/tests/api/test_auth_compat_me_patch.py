"""
H4 — ``PATCH /api/v1/auth/me/`` must let the SPA persist its own profile.

The frontend ``updateProfile`` flow (RESTAuthAdapter → AuthService →
AuthProvider) calls PATCH on ``/auth/me``. Today only GET exists, so every
profile edit dies with 405. The PATCH must accept writable Profile fields
only — account-state fields (``is_active`` etc.) are never accepted.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.models import Profile
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestAuthMePatch:
    def test_patch_updates_own_profile(self):
        user = UserFactory.create()
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch(
            "/api/v1/auth/me/",
            {
                "first_name": "Runtime",
                "last_name": "Patch",
                "display_name": "Runtime Patch",
                "avatar_url": "https://example.com/some-avatar.png",
                "timezone": "America/New_York",
            },
            format="json",
        )

        assert response.status_code == 200

        # Response reflects the update in the frontend shape.
        assert response.data["first_name"] == "Runtime"
        assert response.data["avatar_url"] == "https://example.com/some-avatar.png"

        profile = Profile.objects.get(user=user)
        assert profile.first_name == "Runtime"
        assert profile.display_name == "Runtime Patch"
        assert profile.timezone == "America/New_York"

    def test_patch_ignores_account_state_fields(self):
        user = UserFactory.create(is_active=True)
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch(
            "/api/v1/auth/me/",
            {"is_active": False, "is_staff": True, "is_superuser": True},
            format="json",
        )

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False

    def test_patch_requires_authentication(self):
        client = APIClient()

        response = client.patch("/api/v1/auth/me/", {"first_name": "Nope"}, format="json")

        assert response.status_code == 401
