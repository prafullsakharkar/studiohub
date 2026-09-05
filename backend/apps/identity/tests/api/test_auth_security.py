"""
Auth security tests: DRF login throttling, IP blacklist enforcement,
failure recording, and brute-force lockout.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.models import LoginAttempt
from apps.identity.tests.factories import IPBlacklistFactory, UserFactory


def _make_user(password="secret123"):
    user = UserFactory.create(is_email_verified=True)
    user.set_password(password)
    user.save(update_fields=["password"])
    return user, password


def _login_url():
    return reverse("api:v1:auth-compat:auth-login")


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    # LocMemCache is shared across tests in the process; the login throttle
    # bucket is keyed by client IP, so it must be reset per test.
    # NOTE: do not use override_settings(REST_FRAMEWORK=...) to fake rates —
    # DRF binds SimpleRateThrottle.THROTTLE_RATES at import time, so the
    # override is silently ignored by throttling (while still applying
    # elsewhere). Test the real configured rate instead.
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestLoginThrottling:
    def test_login_scope_configured(self):
        from django.conf import settings

        from apps.core.api.throttling import ResilientScopedRateThrottle
        from apps.identity.api.views.auth_compat import AuthLoginView

        assert AuthLoginView.throttle_scope == "login"
        assert ResilientScopedRateThrottle in AuthLoginView.throttle_classes
        assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["login"] == "30/min"

    def test_login_survives_cache_outage(self, api_client):
        from unittest import mock

        from rest_framework.throttling import SimpleRateThrottle

        user, password = _make_user()

        class BrokenCache:
            def get(self, *args, **kwargs):
                raise ConnectionError("redis down")

            def set(self, *args, **kwargs):
                raise ConnectionError("redis down")

        with mock.patch.object(SimpleRateThrottle, "cache", BrokenCache()):
            response = api_client.post(
                _login_url(),
                {"email": user.email, "password": password},
            )

        assert response.status_code == 200

    def test_login_throttled_after_rate_exceeded(self, api_client):
        user, password = _make_user()

        for _ in range(30):
            response = api_client.post(
                _login_url(),
                {"email": user.email, "password": password},
            )
            assert response.status_code == 200

        response = api_client.post(
            _login_url(),
            {"email": user.email, "password": password},
        )
        assert response.status_code == 429


@pytest.mark.django_db
class TestIPBlacklistEnforcement:
    def test_blacklisted_ip_rejected(self, api_client):
        user, password = _make_user()

        IPBlacklistFactory.create(ip_address="127.0.0.1")

        response = api_client.post(
            _login_url(),
            {"email": user.email, "password": password},
        )

        assert response.status_code == 403
        assert "blocked" in response.data["detail"].lower()

    def test_non_blacklisted_ip_allowed(self, api_client):
        user, password = _make_user()

        response = api_client.post(
            _login_url(),
            {"email": user.email, "password": password},
        )

        assert response.status_code == 200


@pytest.mark.django_db
class TestLoginAttemptRecording:
    def test_successful_login_recorded(self, api_client):
        user, password = _make_user()

        response = api_client.post(
            _login_url(),
            {"email": user.email, "password": password},
        )

        assert response.status_code == 200
        assert LoginAttempt.objects.filter(
            username=user.email,
            success=True,
        ).exists()

    def test_failed_login_recorded(self, api_client):
        user, _ = _make_user()

        response = api_client.post(
            _login_url(),
            {"email": user.email, "password": "wrong-password"},
        )

        assert response.status_code == 401
        attempt = LoginAttempt.objects.filter(
            username=user.email,
            success=False,
        ).first()
        assert attempt is not None
        assert attempt.reason != ""

    def test_lockout_after_max_attempts(self, api_client):
        user, password = _make_user()

        for _ in range(5):
            response = api_client.post(
                _login_url(),
                {"email": user.email, "password": "wrong-password"},
            )
            assert response.status_code == 401

        assert (
            LoginAttempt.objects.filter(
                username=user.email,
                success=False,
            ).count()
            == 5
        )

        response = api_client.post(
            _login_url(),
            {"email": user.email, "password": password},
        )

        assert response.status_code == 401
        assert "too many" in response.data["detail"].lower()
        assert not LoginAttempt.objects.filter(
            username=user.email,
            success=True,
        ).exists()
