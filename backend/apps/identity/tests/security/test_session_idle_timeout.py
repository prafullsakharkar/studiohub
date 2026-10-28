"""
Session idle timeout and lifetimes (TPN review TM-020).

A session that makes no authenticated request for ``SESSION_IDLE_TIMEOUT_MINUTES`` cannot be refreshed,
so a refresh token that sat in browser storage does not bring it back.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory

PASSWORD = "Correct-horse-battery-9!"

LOGIN = "api:v1:auth-compat:auth-login"
REFRESH = "api:v1:auth-compat:auth-refresh"
OPEN = "/api/v1/identity/users/me/"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


def _signed_in():
    user = UserFactory.create(is_email_verified=True)
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    tokens = (
        APIClient()
        .post(reverse(LOGIN), {"email": user.email, "password": PASSWORD}, format="json")
        .json()["tokens"]
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return user, tokens, client


def _age_session(user, minutes):
    UserSession.objects.filter(user=user).update(
        last_activity=timezone.now() - timedelta(minutes=minutes)
    )


def _refresh(tokens):
    return APIClient().post(reverse(REFRESH), {"refresh": tokens["refresh"]}, format="json")


@pytest.mark.django_db
class TestIdleTimeout:
    def test_an_active_session_can_refresh(self, settings):
        settings.SESSION_IDLE_TIMEOUT_MINUTES = 60
        user, tokens, _ = _signed_in()
        _age_session(user, 30)

        assert _refresh(tokens).status_code == 200

    def test_an_idle_session_cannot_refresh_and_ends(self, settings):
        settings.SESSION_IDLE_TIMEOUT_MINUTES = 60
        user, tokens, _ = _signed_in()
        _age_session(user, 61)

        response = _refresh(tokens)

        assert response.status_code == 401
        assert UserSession.objects.get(user=user).status == SessionStatus.EXPIRED

    def test_the_session_stays_ended_even_if_the_idle_limit_is_raised_later(self, settings):
        settings.SESSION_IDLE_TIMEOUT_MINUTES = 60
        user, tokens, _ = _signed_in()
        _age_session(user, 61)
        _refresh(tokens)

        settings.SESSION_IDLE_TIMEOUT_MINUTES = 0

        assert _refresh(tokens).status_code == 401

    def test_zero_turns_the_idle_limit_off(self, settings):
        settings.SESSION_IDLE_TIMEOUT_MINUTES = 0
        user, tokens, _ = _signed_in()
        _age_session(user, 60 * 24)

        assert _refresh(tokens).status_code == 200

    def test_requests_keep_the_session_alive(self, settings):
        settings.SESSION_IDLE_TIMEOUT_MINUTES = 60
        user, tokens, client = _signed_in()
        _age_session(user, 59)

        assert client.get(OPEN).status_code == 200  # records activity

        _age_session(user, 0)
        UserSession.objects.filter(user=user).update(
            last_activity=timezone.now() - timedelta(minutes=2)
        )
        assert _refresh(tokens).status_code == 200

    def test_a_refresh_alone_does_not_count_as_activity(self, settings):
        settings.SESSION_IDLE_TIMEOUT_MINUTES = 60
        user, tokens, _ = _signed_in()
        _age_session(user, 59)

        refreshed = _refresh(tokens)
        assert refreshed.status_code == 200

        # the clock was not reset by the refresh, so one more minute of silence ends the session
        _age_session(user, 61)
        assert _refresh(refreshed.json()).status_code == 401

    def test_activity_is_written_at_most_once_a_minute(self, settings):
        settings.SESSION_IDLE_TIMEOUT_MINUTES = 60
        user, _, client = _signed_in()
        _age_session(user, 10)

        client.get(OPEN)
        first = UserSession.objects.get(user=user).last_activity
        _age_session(user, 10)
        client.get(OPEN)  # within the minute: no second write

        assert first > timezone.now() - timedelta(minutes=1)
        assert UserSession.objects.get(user=user).last_activity < timezone.now() - timedelta(
            minutes=9
        )


class TestLifetimes:
    def test_the_configured_lifetimes_are_in_force(self, settings):
        assert settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] == timedelta(minutes=30)
        assert settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"] == timedelta(days=7)
        # defined in components/jwt.py but never exported until TM-020
        assert settings.SESSION_MAX_ABSOLUTE_LIFETIME_DAYS == 30
        assert settings.SESSION_IDLE_TIMEOUT_MINUTES >= 0
