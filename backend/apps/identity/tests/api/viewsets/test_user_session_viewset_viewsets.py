"""
Identity user session endpoint tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.choices import (
    SessionStatus,
)
from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import UserSessionFactory


@pytest.mark.django_db
class TestUserSessionViewSet:
    """Tests for UserSessionViewSet."""

    def test_list_unauthenticated(self, api_client):
        response = api_client.get(reverse("api:v1:identity:session-list"))
        assert response.status_code == 401

    def test_list_scoped_to_user(self, authenticated_client, user):
        UserSessionFactory.create_batch(
            2,
            user=user,
        )

        UserSessionFactory.create(
            user=UserFactory.create(),
        )

        response = authenticated_client.get(reverse("api:v1:identity:session-list"))
        assert response.status_code == 200

        results = response.data["results"] if isinstance(response.data, dict) else response.data
        assert len(results) == 2

        for session in results:
            assert session["user_id"] == user.id
            assert "user_agent" in session
            assert "is_current" in session
            assert "expires_at" in session

    def test_current_with_active_session(self, authenticated_client, user):
        UserSessionFactory.create(
            user=user,
            is_current=True,
        )

        response = authenticated_client.get(reverse("api:v1:identity:session-current"))
        assert response.status_code == 200
        assert response.data["is_current"] is True

    def test_current_without_active_session(self, authenticated_client):
        response = authenticated_client.get(reverse("api:v1:identity:session-current"))
        assert response.status_code == 404

    def test_revoke_own_session(self, authenticated_client, user):
        session = UserSessionFactory.create(
            user=user,
            is_current=False,
        )

        response = authenticated_client.post(
            reverse(
                "api:v1:identity:session-revoke",
                kwargs={"pk": session.id},
            ),
        )
        assert response.status_code == 200

        session.refresh_from_db()
        assert session.status == SessionStatus.REVOKED
        assert session.is_current is False
        assert session.logged_out_at is not None

    def test_revoke_other_users_session(self, authenticated_client):
        session = UserSessionFactory.create(
            user=UserFactory.create(),
        )

        response = authenticated_client.post(
            reverse(
                "api:v1:identity:session-revoke",
                kwargs={"pk": session.id},
            ),
        )
        assert response.status_code == 404

    def test_revoke_all_other(self, authenticated_client, user):
        UserSessionFactory.create(
            user=user,
            is_current=True,
        )

        others = UserSessionFactory.create_batch(
            2,
            user=user,
            is_current=False,
        )

        response = authenticated_client.post(
            reverse("api:v1:identity:session-revoke-all-other"),
        )
        assert response.status_code == 200
        assert response.data["sessions"] == 2

        for session in others:
            session.refresh_from_db()
            assert session.status == SessionStatus.LOGGED_OUT

    def test_activity(self, authenticated_client, user):
        session = UserSessionFactory.create(
            user=user,
        )

        response = authenticated_client.get(
            reverse(
                "api:v1:identity:session-activity",
                kwargs={"pk": session.id},
            ),
        )
        assert response.status_code == 200
        assert len(response.data["activity"]) >= 1

    def test_admin_list_requires_staff(self, authenticated_client):
        target = UserFactory.create()

        UserSessionFactory.create_batch(
            2,
            user=target,
        )

        response = authenticated_client.get(
            reverse(
                "api:v1:identity:session-admin-list",
                kwargs={"user_id": target.id},
            ),
        )
        assert response.status_code == 403

    def test_admin_list_staff(self, staff_client):
        target = UserFactory.create()

        UserSessionFactory.create_batch(
            2,
            user=target,
        )

        response = staff_client.get(
            reverse(
                "api:v1:identity:session-admin-list",
                kwargs={"user_id": target.id},
            ),
        )
        assert response.status_code == 200

        results = response.data["results"] if isinstance(response.data, dict) else response.data
        assert len(results) == 2

    def test_admin_revoke_all_staff(self, staff_client):
        target = UserFactory.create()

        UserSessionFactory.create_batch(
            2,
            user=target,
        )

        response = staff_client.post(
            reverse(
                "api:v1:identity:session-admin-revoke-all",
                kwargs={"user_id": target.id},
            ),
        )
        assert response.status_code == 200
        assert response.data["sessions"] == 2

    def test_admin_revoke_all_unknown_user(self, staff_client):
        response = staff_client.post(
            reverse(
                "api:v1:identity:session-admin-revoke-all",
                kwargs={"user_id": 999999},
            ),
        )
        assert response.status_code == 404
