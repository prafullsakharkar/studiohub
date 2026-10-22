from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestAuthCompatChangePassword:
    def test_change_password_succeeds_and_returns_detail(self):
        user = UserFactory.create(is_active=True)
        user.set_password("Old-pass-1")
        user.save(update_fields=["password"])

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/auth/change-password/",
            {
                "old_password": "Old-pass-1",
                "new_password": "New-pass-1",
                "confirm_password": "New-pass-1",
            },
            format="json",
        )

        assert response.status_code == 200
        assert "detail" in response.data
        user.refresh_from_db()
        assert user.check_password("New-pass-1")

    def test_wrong_old_password_returns_401(self):
        user = UserFactory.create(is_active=True)
        user.set_password("Old-pass-1")
        user.save(update_fields=["password"])

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/auth/change-password/",
            {
                "old_password": "wrong",
                "new_password": "New-pass-1",
                "confirm_password": "New-pass-1",
            },
            format="json",
        )

        assert response.status_code == 401

    def test_requires_authentication(self):
        client = APIClient()

        response = client.post(
            "/api/v1/auth/change-password/",
            {
                "old_password": "x",
                "new_password": "New-pass-1",
                "confirm_password": "New-pass-1",
            },
            format="json",
        )

        assert response.status_code == 401
