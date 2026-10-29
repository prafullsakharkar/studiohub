"""
Settings and policy hardening (WP 8.3): production CORS, throttling of the
endpoints that verify a password or second factor, one password policy.
"""

from __future__ import annotations

import importlib

import pytest
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.services.password import PasswordService
from apps.identity.tests.factories import UserFactory

PASSWORD = "Correct-horse-battery-9!"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


class TestProductionCors:
    def test_production_never_allows_every_origin_even_if_debug_leaked_into_base(self, monkeypatch):
        import config.settings.base as base

        monkeypatch.setattr(base, "CORS_ALLOW_ALL_ORIGINS", True)
        production = importlib.import_module("config.settings.production")

        try:
            production = importlib.reload(production)

            assert production.CORS_ALLOW_ALL_ORIGINS is False
            assert production.DEBUG is False
            assert production.SESSION_COOKIE_SECURE is True
            assert production.CSRF_COOKIE_SECURE is True
        finally:
            monkeypatch.undo()
            importlib.reload(production)

    def test_credentials_are_only_allowed_with_an_explicit_origin_list_outside_debug(self):
        from config.settings.components import cors

        assert cors.settings.debug == cors.CORS_ALLOW_ALL_ORIGINS


@pytest.mark.django_db
class TestSensitiveEndpointsAreThrottled:
    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def _user(self):
        user = UserFactory.create(is_email_verified=True)
        user.set_password(PASSWORD)
        user.save(update_fields=["password"])
        return user

    def _hammer(self, url, body, times=25):
        client = self._client(self._user())
        codes = [client.post(url, body, format="json").status_code for _ in range(times)]
        return codes

    @pytest.mark.parametrize(
        ("name", "body"),
        [
            (
                "api:v1:auth-compat:auth-change-password",
                {
                    "old_password": "nope",
                    "new_password": "Brand-new-pass-1!",
                    "confirm_password": "x",
                },
            ),
            ("api:v1:identity:mfa-totp-disable", {"password": "nope"}),
            ("api:v1:identity:mfa-recovery-codes-regenerate", {"password": "nope"}),
            ("api:v1:identity:mfa-disable", {"password": "nope"}),
            ("api:v1:identity:mfa-verify", {"code": "000000"}),
            ("api:v1:identity:mfa-recovery-verify", {"code": "AAAA-AAA-AA"}),
        ],
    )
    def test_guessing_is_cut_off(self, name, body):
        codes = self._hammer(reverse(name), body)

        assert 429 in codes, codes
        assert codes.index(429) <= 21

    def test_credential_issuing_is_throttled(self):
        user = self._user()
        client = self._client(user)
        url = reverse("api:v1:identity:personal-access-token-list")

        codes = [
            client.post(url, {"name": "x", "scopes": []}, format="json").status_code
            for _ in range(25)
        ]

        assert 429 in codes

    def test_the_read_only_mfa_config_is_not_throttled(self):
        client = self._client(self._user())

        codes = {
            client.get(reverse("api:v1:identity:mfa-config-compat")).status_code for _ in range(30)
        }

        assert codes == {200}

    def test_throttling_is_per_user(self):
        noisy = self._client(self._user())
        quiet = self._client(self._user())
        url = reverse("api:v1:identity:mfa-totp-disable")
        for _ in range(25):
            noisy.post(url, {"password": "nope"}, format="json")

        assert quiet.post(url, {"password": "nope"}, format="json").status_code != 429


@pytest.mark.django_db
class TestOnePasswordPolicy:
    @pytest.mark.parametrize(
        "weak",
        [
            "alllowercase99",  # no uppercase (identity rule)
            "NOLOWERCASE99",  # no lowercase (identity rule)
            "NoDigitsHere",  # no digit (identity rule)
            "Has a space 1A",  # spaces
            "Password1",  # on the common-password list (Django rule)
            "Sh0rt",  # too short
            "1234567890",  # all numeric
        ],
    )
    def test_the_service_rejects_every_weak_form_so_reset_cannot_bypass_it(self, weak):
        user = UserFactory.create()

        with pytest.raises(ValidationError):
            PasswordService.set_password(user=user, new_password=weak)

    def test_a_strong_password_is_accepted(self):
        user = UserFactory.create()

        PasswordService.set_password(user=user, new_password=PASSWORD)

        user.refresh_from_db()
        assert user.check_password(PASSWORD)

    def test_a_password_similar_to_the_email_is_rejected(self):
        user = UserFactory.create(email="jordanwhitfield@example.com")

        with pytest.raises(ValidationError):
            PasswordService.set_password(user=user, new_password="Jordanwhitfield1")

    def test_user_creation_over_the_api_applies_the_same_policy(self):
        operator = UserFactory.create(is_superuser=True, is_staff=True)
        client = APIClient()
        client.force_authenticate(user=operator)

        weak = client.post(
            reverse("api:v1:identity:user-list"),
            {"email": "weak@example.com", "password": "Password1"},
            format="json",
        )
        strong = client.post(
            reverse("api:v1:identity:user-list"),
            {"email": "strong@example.com", "password": PASSWORD},
            format="json",
        )

        assert weak.status_code == 400
        assert strong.status_code == 201
