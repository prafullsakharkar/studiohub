from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.models import UserSession
from apps.identity.tests.factories import ProfileFactory, UserSessionFactory


@pytest.mark.django_db
class TestUserChangePassword:
    def _url(self):
        return reverse("api:v1:identity:user-change-password")

    def test_requires_matching_old_password(self, staff_client, staff_user):
        staff_user.set_password("Old-pass-1")
        staff_user.save(update_fields=["password"])

        response = staff_client.post(
            self._url(),
            {
                "old_password": "Wrong-pass-1",
                "new_password": "New-pass-1",
                "confirm_password": "New-pass-1",
            },
            format="json",
        )

        assert response.status_code == 401

        staff_user.refresh_from_db()
        assert staff_user.check_password("Old-pass-1")

    def test_changes_password_clears_flag_and_revokes_sessions(
        self,
        staff_client,
        staff_user,
    ):
        profile = ProfileFactory.create(
            user=staff_user,
            must_change_password=True,
        )
        UserSessionFactory.create(user=staff_user)

        staff_user.set_password("Old-pass-1")
        staff_user.save(update_fields=["password"])

        response = staff_client.post(
            self._url(),
            {
                "old_password": "Old-pass-1",
                "new_password": "New-pass-1",
                "confirm_password": "New-pass-1",
            },
            format="json",
        )

        assert response.status_code == 200

        staff_user.refresh_from_db()
        assert staff_user.check_password("New-pass-1")

        profile.refresh_from_db()
        assert profile.must_change_password is False

        assert not UserSession.objects.active().by_user(staff_user).exists()

    def test_rejects_weak_password(self, staff_client, staff_user):
        staff_user.set_password("Old-pass-1")
        staff_user.save(update_fields=["password"])

        response = staff_client.post(
            self._url(),
            {
                "old_password": "Old-pass-1",
                "new_password": "weak",
                "confirm_password": "weak",
            },
            format="json",
        )

        assert response.status_code == 400

    def test_rejects_mismatched_confirmation(self, staff_client, staff_user):
        response = staff_client.post(
            self._url(),
            {
                "old_password": "Old-pass-1",
                "new_password": "New-pass-1",
                "confirm_password": "Different-pass-1",
            },
            format="json",
        )

        assert response.status_code == 400
        assert "confirm_password" in response.data
