"""
Breached-password screening and the MFA default (TPN review TM-007).

The check is opt-in, sends only a five-character hash prefix, accepts the password when the service is
unreachable unless told to fail closed, and never sees the plaintext.
"""

from __future__ import annotations

import hashlib
import urllib.error

import pytest
from django.core.exceptions import ValidationError

from apps.identity.validators import breach
from config.env import Settings

PASSWORD = "Tr0ub4dor-and-3-horses"


def digest(password: str = PASSWORD) -> tuple[str, str]:
    full = hashlib.sha1(password.encode(), usedforsecurity=False).hexdigest().upper()  # noqa: S324
    return full[:5], full[5:]


@pytest.fixture
def on(settings):
    settings.PASSWORD_BREACH_CHECK = True
    settings.PASSWORD_BREACH_CHECK_FAIL_CLOSED = False
    return settings


@pytest.fixture
def service(monkeypatch):
    """Replace the network call; ``service.prefixes`` records what would have been sent."""

    class Fake:
        prefixes: list[str] = []
        answer: dict[str, int] = {}
        error: Exception | None = None

    def fake(prefix):
        Fake.prefixes.append(prefix)
        if Fake.error:
            raise Fake.error
        return Fake.answer

    Fake.prefixes = []
    Fake.answer = {}
    Fake.error = None
    monkeypatch.setattr(breach, "_suffix_counts", fake)
    return Fake


class TestValidator:
    def test_off_by_default_and_makes_no_call(self, settings, service):
        settings.PASSWORD_BREACH_CHECK = False

        breach.BreachedPasswordValidator().validate(PASSWORD)

        assert service.prefixes == []

    def test_a_breached_password_is_rejected(self, on, service):
        prefix, suffix = digest()
        service.answer = {suffix: 4821, "0" * 35: 0}

        with pytest.raises(ValidationError) as caught:
            breach.BreachedPasswordValidator().validate(PASSWORD)

        assert caught.value.code == "password_breached"

    def test_only_the_prefix_is_sent(self, on, service):
        breach.BreachedPasswordValidator().validate(PASSWORD)

        prefix, suffix = digest()
        assert service.prefixes == [prefix]
        assert len(service.prefixes[0]) == 5
        assert suffix not in service.prefixes[0]

    def test_padding_entries_with_a_zero_count_do_not_reject(self, on, service):
        _prefix, suffix = digest()
        service.answer = {suffix: 0}

        breach.BreachedPasswordValidator().validate(PASSWORD)

    def test_an_unreachable_service_accepts_by_default(self, on, service):
        service.error = urllib.error.URLError("down")

        breach.BreachedPasswordValidator().validate(PASSWORD)

    def test_an_unreachable_service_rejects_when_failing_closed(self, on, service):
        on.PASSWORD_BREACH_CHECK_FAIL_CLOSED = True
        service.error = TimeoutError()

        with pytest.raises(ValidationError) as caught:
            breach.BreachedPasswordValidator().validate(PASSWORD)

        assert caught.value.code == "password_breach_check_unavailable"


class TestResponseParsing:
    def test_it_reads_suffix_count_lines_and_ignores_junk(self, monkeypatch):
        body = b"ABCDE:3\r\n00000:0\r\nnot a line\r\nFFFFF:12\r\n"

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def read(self):
                return body

        captured = {}

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["padding"] = request.get_header("Add-padding")
            captured["timeout"] = timeout
            return Response()

        monkeypatch.setattr(breach.urllib.request, "urlopen", fake_urlopen)

        assert breach._suffix_counts("21BD1") == {"ABCDE": 3, "00000": 0, "FFFFF": 12}
        assert captured == {
            "url": "https://api.pwnedpasswords.com/range/21BD1",
            "padding": "true",
            "timeout": breach.TIMEOUT_SECONDS,
        }


class TestPolicyIntegration:
    def test_the_validator_is_part_of_the_password_policy(self, on, service):
        from apps.identity.validators.password import validate_password

        _prefix, suffix = digest()
        service.answer = {suffix: 9}

        with pytest.raises(ValidationError):
            validate_password(PASSWORD)


BASE = {
    "DJANGO_SECRET_KEY": "x" * 50,
    "DB_NAME": "n",
    "DB_USER": "u",
    "DB_PASSWORD": "p",
    "DB_HOST": "db",
    "REDIS_HOST": "cache",
    "EMAIL_HOST": "mail",
    "CELERY_BROKER_URL": "redis://:pw@cache:6379/0",
    "CELERY_RESULT_BACKEND": "redis://:pw@cache:6379/1",
}


class TestMfaForEveryoneDefault:
    def build(self, monkeypatch, **extra):
        for key in [*BASE, "MFA_REQUIRE_ALL", "DJANGO_ENV"]:
            monkeypatch.delenv(key, raising=False)
        for key, value in {**BASE, **extra}.items():
            monkeypatch.setenv(key, value)
        return Settings(_env_file=None)  # pyright: ignore[reportCallIssue]

    def test_it_is_on_in_production_unless_overridden(self, monkeypatch):
        assert self.build(monkeypatch, DJANGO_ENV="production").mfa_required_for_all is True
        assert (
            self.build(
                monkeypatch, DJANGO_ENV="production", MFA_REQUIRE_ALL="false"
            ).mfa_required_for_all
            is False
        )

    @pytest.mark.parametrize("env", ["local", "docker", "testing", "ci"])
    def test_it_is_off_elsewhere_unless_set(self, monkeypatch, env):
        assert self.build(monkeypatch, DJANGO_ENV=env).mfa_required_for_all is False
        assert (
            self.build(monkeypatch, DJANGO_ENV=env, MFA_REQUIRE_ALL="true").mfa_required_for_all
            is True
        )
