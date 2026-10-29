"""
Login hardening with real authentication (WP 5.1 / 5.6).

Covers: identical failure for every non-success cause, one password hash per
attempt regardless of account existence, lockout uniformity, best-effort and
rate-limited security events, and that no secret ever reaches the logs.
"""

from __future__ import annotations

import logging

import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.choices import SecurityEventType
from apps.identity.models import LoginAttempt, SecurityEvent
from apps.identity.services.security_event import SecurityEventService
from apps.identity.tests.factories import UserFactory
from apps.identity.validators import authentication as validator_module

PASSWORD = "Correct-horse-battery-9!"
LOGIN = "api:v1:auth-compat:auth-login"
REFRESH = "api:v1:auth-compat:auth-refresh"


def _user(**kwargs):
    user = UserFactory.create(is_email_verified=True, **kwargs)
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    return user


def _login(email, password):
    return APIClient().post(
        reverse(LOGIN),
        {"email": email, "password": password},
        format="json",
    )


def _shape(response):
    """Everything a client can observe, minus the per-request id."""
    body = response.json()
    return (
        response.status_code,
        body.get("detail"),
        (body.get("error") or {}).get("code"),
    )


def _events(user, event_type):
    return SecurityEvent.objects.filter(user=user, event_type=event_type)


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestIdenticalFailure:
    def _failures(self):
        wrong = _user()
        inactive = _user(is_active=False)
        deleted = _user()
        deleted.is_deleted = True
        deleted.save(update_fields=["is_deleted"])
        return {
            "wrong_password": _login(wrong.email, "not-the-password"),
            "unknown_user": _login("nobody-here@example.com", PASSWORD),
            "inactive_correct_password": _login(inactive.email, PASSWORD),
            "inactive_wrong_password": _login(inactive.email, "not-the-password"),
            "deleted_correct_password": _login(deleted.email, PASSWORD),
        }

    def test_every_failure_is_the_same_to_the_client(self):
        shapes = {name: _shape(r) for name, r in self._failures().items()}

        assert len(set(shapes.values())) == 1, shapes
        status, detail, code = next(iter(shapes.values()))
        assert status == 401
        assert detail == "Invalid username or password."
        assert code == "authentication_failed"

    def test_inactive_message_never_reveals_the_account_state(self):
        inactive = _user(is_active=False)

        body = _login(inactive.email, PASSWORD).content.decode().lower()

        assert "inactive" not in body
        assert "locked" not in body
        assert "disabled" not in body

    def test_the_precise_reason_is_kept_in_the_attempt_ledger(self):
        inactive = _user(is_active=False)
        wrong = _user()

        _login(inactive.email, PASSWORD)
        _login(wrong.email, "nope")
        _login("ghost@example.com", "nope")

        reasons = set(LoginAttempt.objects.values_list("reason", flat=True))
        assert {"user_inactive", "invalid_password", "unknown_user"} <= reasons


@pytest.mark.django_db
class TestOneHashPerAttempt:
    """Account existence must not change the amount of hashing work."""

    @pytest.fixture
    def hash_calls(self, monkeypatch):
        calls = []
        real = validator_module.check_password

        def counting(password, encoded, *args, **kwargs):
            calls.append(encoded)
            return real(password, encoded, *args, **kwargs)

        monkeypatch.setattr(validator_module, "check_password", counting)
        return calls

    def test_unknown_user_costs_one_hash(self, hash_calls):
        _login("ghost@example.com", PASSWORD)

        assert len(hash_calls) == 1

    def test_wrong_password_costs_one_hash(self, hash_calls):
        user = _user()

        _login(user.email, "nope")

        assert len(hash_calls) == 1

    def test_inactive_account_with_correct_password_costs_one_hash(self, hash_calls):
        user = _user(is_active=False)

        response = _login(user.email, PASSWORD)

        assert len(hash_calls) == 1
        assert response.status_code == 401

    def test_unusable_password_account_still_hashes_once(self, hash_calls):
        user = UserFactory.create()
        user.set_unusable_password()
        user.save(update_fields=["password"])

        response = _login(user.email, PASSWORD)

        assert len(hash_calls) == 1
        assert response.status_code == 401

    def test_successful_login_costs_one_hash(self, hash_calls):
        user = _user()

        assert _login(user.email, PASSWORD).status_code == 200
        assert len(hash_calls) == 1

    def test_unknown_and_known_users_hash_with_the_same_hasher(self, hash_calls):
        user = _user()

        _login(user.email, "nope")
        _login("ghost@example.com", "nope")

        known, unknown = hash_calls
        assert known.split("$")[0] == unknown.split("$")[0]


@pytest.mark.django_db
class TestLockout:
    def test_lockout_applies_to_known_and_unknown_names_alike(self):
        known = _user()
        attempts = validator_module.AuthenticationValidator.MAX_LOGIN_ATTEMPTS

        for _ in range(attempts):
            _login(known.email, "nope")
            _login("ghost@example.com", "nope")

        locked_known = _login(known.email, PASSWORD)
        locked_unknown = _login("ghost@example.com", PASSWORD)

        assert _shape(locked_known) == _shape(locked_unknown)
        assert locked_known.status_code in (401, 429)

    def test_correct_password_does_not_bypass_a_lockout(self):
        user = _user()
        for _ in range(validator_module.AuthenticationValidator.MAX_LOGIN_ATTEMPTS):
            _login(user.email, "nope")

        assert _login(user.email, PASSWORD).status_code != 200


@pytest.mark.django_db
class TestSecurityEvents:
    def test_success_emits_login_and_session_events(self):
        user = _user()

        assert _login(user.email, PASSWORD).status_code == 200

        assert _events(user, SecurityEventType.LOGIN_SUCCESS).count() == 1
        assert _events(user, SecurityEventType.SESSION_CREATED).count() == 1

    def test_failure_emits_one_event_and_is_rate_limited(self):
        user = _user()

        for _ in range(3):
            _login(user.email, "nope")

        events = _events(user, SecurityEventType.LOGIN_FAILED)
        assert events.count() == 1
        assert events.get().metadata["reason"] == "invalid_password"

    def test_unknown_username_writes_no_security_event(self):
        before = SecurityEvent.objects.count()

        _login("ghost@example.com", "nope")

        assert SecurityEvent.objects.count() == before

    def test_lockout_emits_a_login_locked_event_once(self):
        user = _user()
        for _ in range(validator_module.AuthenticationValidator.MAX_LOGIN_ATTEMPTS):
            _login(user.email, "nope")

        _login(user.email, PASSWORD)
        _login(user.email, PASSWORD)

        assert _events(user, SecurityEventType.LOGIN_LOCKED).count() == 1

    def test_refresh_emits_token_refreshed(self):
        user = _user()
        tokens = _login(user.email, PASSWORD).json()["tokens"]

        response = APIClient().post(reverse(REFRESH), {"refresh": tokens["refresh"]}, format="json")

        assert response.status_code == 200
        assert _events(user, SecurityEventType.TOKEN_REFRESHED).count() == 1

    def test_audit_failure_never_breaks_login(self, monkeypatch):
        user = _user()

        def boom(*args, **kwargs):
            raise RuntimeError("audit store down")

        monkeypatch.setattr(SecurityEventService, "create", boom)

        assert _login(user.email, PASSWORD).status_code == 200
        assert _login(user.email, "nope").status_code == 401


@pytest.mark.django_db
class TestNothingSecretIsLogged:
    def test_no_password_or_token_in_any_log_record(self, caplog):
        user = _user()
        caplog.set_level(logging.DEBUG)

        ok = _login(user.email, PASSWORD)
        tokens = ok.json()["tokens"]
        _login(user.email, "a-wrong-password-value")
        APIClient().post(reverse(REFRESH), {"refresh": tokens["refresh"]}, format="json")

        text = "\n".join(
            f"{r.getMessage()} {r.__dict__.get('extra', '')} {r.exc_text or ''}"
            for r in caplog.records
        )
        for secret in (
            PASSWORD,
            "a-wrong-password-value",
            tokens["access"],
            tokens["refresh"],
        ):
            assert secret not in text
