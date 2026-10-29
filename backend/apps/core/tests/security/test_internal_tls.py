"""
TLS on the links to the database and Redis (TPN review TM-009).

The settings turn it on from the environment, and ``check --deploy`` reports a link that is not
encrypted and verified: a warning by default, an error with ``INTERNAL_TLS_REQUIRED``.
"""

from __future__ import annotations

import pytest

from apps.core import checks
from config.env import Settings

BASE_ENV = {
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


def build(monkeypatch, **extra):
    for key in list(BASE_ENV) + [
        "DB_SSLMODE",
        "DB_SSLROOTCERT",
        "REDIS_TLS",
        "REDIS_CA_CERT",
        "INTERNAL_TLS_REQUIRED",
    ]:
        monkeypatch.delenv(key, raising=False)
    for key, value in {**BASE_ENV, **extra}.items():
        monkeypatch.setenv(key, value)
    return Settings(_env_file=None)  # pyright: ignore[reportCallIssue]


class TestEnvironmentSettings:
    def test_defaults_leave_the_driver_alone(self, monkeypatch):
        config = build(monkeypatch)

        assert "OPTIONS" not in config.database
        assert config.redis_url.startswith("redis://")

    def test_database_options_follow_the_environment(self, monkeypatch):
        config = build(monkeypatch, DB_SSLMODE="verify-full", DB_SSLROOTCERT="/run/tls/ca.pem")

        assert config.database["OPTIONS"] == {
            "sslmode": "verify-full",
            "sslrootcert": "/run/tls/ca.pem",
        }

    def test_redis_tls_switches_the_scheme(self, monkeypatch):
        config = build(monkeypatch, REDIS_TLS="true", REDIS_PASSWORD="pw")

        assert config.redis_url == "rediss://:pw@cache:6379/0"


@pytest.fixture
def plain(settings):
    settings.DATABASES = {"default": {"ENGINE": "django.db.backends.postgresql", "OPTIONS": {}}}
    settings.CACHES = {"default": {"LOCATION": "redis://:pw@cache:6379/0"}}
    settings.CELERY_BROKER_URL = "redis://:pw@cache:6379/0"
    settings.CELERY_RESULT_BACKEND = "redis://:pw@cache:6379/1"
    settings.INTERNAL_TLS_REQUIRED = False
    return settings


def ids(findings):
    return sorted(finding.id for finding in findings)


class TestDeployCheck:
    def test_plain_links_warn(self, plain):
        assert ids(checks.internal_links_are_encrypted(None)) == [
            "core.W006",
            "core.W007",
            "core.W007",
            "core.W007",
        ]

    def test_required_makes_them_errors(self, plain):
        plain.INTERNAL_TLS_REQUIRED = True

        assert ids(checks.internal_links_are_encrypted(None)) == [
            "core.E006",
            "core.E007",
            "core.E007",
            "core.E007",
        ]

    @pytest.mark.parametrize("mode", ["verify-full", "verify-ca"])
    def test_a_verifying_database_mode_passes(self, plain, mode):
        plain.DATABASES["default"]["OPTIONS"] = {"sslmode": mode}
        plain.CACHES = {"default": {"LOCATION": "rediss://:pw@cache:6379/0"}}
        plain.CELERY_BROKER_URL = "rediss://:pw@cache:6379/0"
        plain.CELERY_RESULT_BACKEND = "rediss://:pw@cache:6379/1"

        assert checks.internal_links_are_encrypted(None) == []

    @pytest.mark.parametrize("mode", ["require", "prefer", "disable", "allow"])
    def test_a_mode_that_does_not_verify_is_reported(self, plain, mode):
        plain.DATABASES["default"]["OPTIONS"] = {"sslmode": mode}

        assert "core.W006" in ids(checks.internal_links_are_encrypted(None))

    def test_sqlite_is_not_checked(self, plain):
        plain.DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3"}}
        plain.CACHES = {"default": {"LOCATION": "rediss://:pw@cache:6379/0"}}
        plain.CELERY_BROKER_URL = "rediss://:pw@cache:6379/0"
        plain.CELERY_RESULT_BACKEND = "rediss://:pw@cache:6379/1"

        assert checks.internal_links_are_encrypted(None) == []
