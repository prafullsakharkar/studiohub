"""
Identity user account action endpoint tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import UserSessionFactory


@pytest.mark.django_db
class TestUserAccountActions:
    """Tests for suspend/unsuspend/reset-password/force-password-change/revoke-sessions."""

    def test_suspend_unauthenticated(self, api_client):
        user = UserFactory.create()
        response = api_client.post(
            reverse(
                "api:v1:identity:user-suspend",
                kwargs={"pk": user.id},
            ),
        )
        assert response.status_code == 401

    def test_suspend_user(self, staff_client):
        user = UserFactory.create()
        response = staff_client.post(
            reverse(
                "api:v1:identity:user-suspend",
                kwargs={"pk": user.id},
            ),
        )
        assert response.status_code == 200

        user.refresh_from_db()
        assert user.is_active is False

    def test_unsuspend_user(self, staff_client):
        user = UserFactory.create(is_active=False)
        response = staff_client.post(
            reverse(
                "api:v1:identity:user-unsuspend",
                kwargs={"pk": user.id},
            ),
        )
        assert response.status_code == 200

        user.refresh_from_db()
        assert user.is_active is True

    def test_reset_password_user(self, staff_client):
        user = UserFactory.create()
        response = staff_client.post(
            reverse(
                "api:v1:identity:user-reset-password",
                kwargs={"pk": user.id},
            ),
        )
        assert response.status_code == 200

    def test_force_password_change(self, staff_client):
        user = UserFactory.create()
        response = staff_client.post(
            reverse(
                "api:v1:identity:user-force-password-change",
                kwargs={"pk": user.id},
            ),
        )
        assert response.status_code == 200

        user.profile.refresh_from_db()
        assert user.profile.must_change_password is True

    def test_revoke_sessions(self, staff_client):
        user = UserFactory.create()

        UserSessionFactory.create_batch(
            2,
            user=user,
        )

        response = staff_client.post(
            reverse(
                "api:v1:identity:user-revoke-sessions",
                kwargs={"pk": user.id},
            ),
        )
        assert response.status_code == 200
        assert response.data["sessions"] == 2

        user.organization_sessions.all().delete()
