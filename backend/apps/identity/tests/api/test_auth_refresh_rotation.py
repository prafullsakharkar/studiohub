"""
Compat refresh rotation tests: the rotated refresh token must be returned.

Rotation blacklists the presented refresh server-side, so the response has to
carry the NEW refresh token — otherwise the client's stored refresh dies on
the next rotation and the session force-logs-out (Phase 2 gap P0-1).
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import UserFactory


def _make_user(password="secret123"):
    user = UserFactory.create(is_email_verified=True)
    user.set_password(password)
    user.save(update_fields=["password"])
    return user, password


def _login_url():
    return reverse("api:v1:auth-compat:auth-login")


def _refresh_url():
    return reverse("api:v1:auth-compat:auth-refresh")


@pytest.mark.django_db
class TestCompatRefreshRotation:
    def test_refresh_returns_rotated_pair(self, api_client):
        user, password = _make_user()
        login = api_client.post(
            _login_url(),
            {"email": user.email, "password": password},
            format="json",
        )
        assert login.status_code == 200, login.data
        refresh = login.data["tokens"]["refresh"]

        resp = api_client.post(_refresh_url(), {"refresh": refresh}, format="json")

        assert resp.status_code == 200, resp.data
        assert resp.data["access"]
        assert resp.data["refresh"]
        assert resp.data["refresh"] != refresh

    def test_second_refresh_with_rotated_token_succeeds(self, api_client):
        user, password = _make_user()
        login = api_client.post(
            _login_url(),
            {"email": user.email, "password": password},
            format="json",
        )
        assert login.status_code == 200, login.data

        first = api_client.post(
            _refresh_url(),
            {"refresh": login.data["tokens"]["refresh"]},
            format="json",
        )
        assert first.status_code == 200, first.data

        second = api_client.post(
            _refresh_url(),
            {"refresh": first.data["refresh"]},
            format="json",
        )
        assert second.status_code == 200, second.data
        assert second.data["access"]

    def test_reused_refresh_is_rejected(self, api_client):
        user, password = _make_user()
        login = api_client.post(
            _login_url(),
            {"email": user.email, "password": password},
            format="json",
        )
        assert login.status_code == 200, login.data
        old_refresh = login.data["tokens"]["refresh"]

        first = api_client.post(_refresh_url(), {"refresh": old_refresh}, format="json")
        assert first.status_code == 200, first.data

        replay = api_client.post(_refresh_url(), {"refresh": old_refresh}, format="json")
        assert replay.status_code in (400, 401), replay.data
