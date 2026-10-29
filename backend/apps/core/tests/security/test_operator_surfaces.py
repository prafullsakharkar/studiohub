"""
Operator surfaces and deployment checks (TPN review TM-003, TM-004, TM-006, TM-010).

The admin site and the API docs are not mounted unless switched on; the schema needs a login; and
``check --deploy`` refuses an unauthenticated Redis or a weak signing key.
"""

from __future__ import annotations

import importlib

import pytest
from django.core.checks import Error
from django.test import override_settings
from django.urls import clear_url_caches
from rest_framework.test import APIClient

from apps.core import checks
from apps.identity.tests.factories import UserFactory


def _routes():
    import config.urls

    clear_url_caches()
    return {str(pattern.pattern) for pattern in importlib.reload(config.urls).urlpatterns}


@pytest.fixture
def surfaces_off(settings):
    settings.DEBUG = False
    settings.ADMIN_ENABLED = False
    settings.API_DOCS_ENABLED = False
    yield
    settings.ADMIN_ENABLED = True
    settings.API_DOCS_ENABLED = True
    _routes()


class TestSurfacesAreOptIn:
    def test_admin_and_docs_are_not_mounted_by_default(self, surfaces_off):
        routes = _routes()

        assert "admin/" not in routes
        assert "api/schema/" not in routes
        assert "api/schema/swagger-ui/" not in routes
        assert "health/" in routes

    def test_each_can_be_switched_on_separately(self, settings, surfaces_off):
        settings.ADMIN_ENABLED = True
        assert "admin/" in _routes()
        assert "api/schema/" not in _routes()

        settings.ADMIN_ENABLED = False
        settings.API_DOCS_ENABLED = True
        assert "api/schema/" in _routes()
        assert "admin/" not in _routes()


@pytest.mark.django_db
class TestSchemaNeedsALogin:
    def test_anonymous_callers_are_refused(self):
        assert APIClient().get("/api/schema/").status_code in {401, 403}

    def test_an_authenticated_caller_can_read_it(self):
        client = APIClient()
        client.force_authenticate(user=UserFactory())

        assert client.get("/api/schema/").status_code == 200


class TestSharedServicesNeedCredentials:
    def _errors(self, **overrides):
        with override_settings(**overrides):
            return checks.shared_services_need_credentials(None)

    def test_an_unauthenticated_redis_is_an_error_in_each_place_it_is_used(self):
        errors = self._errors(
            CACHES={"default": {"LOCATION": "redis://redis:6379/0"}},
            CELERY_BROKER_URL="redis://redis:6379/1",
            CELERY_RESULT_BACKEND="redis://redis:6379/2",
        )

        assert len(errors) == 3
        assert all(isinstance(error, Error) and error.id == "core.E001" for error in errors)

    def test_authenticated_urls_pass(self):
        assert not self._errors(
            CACHES={"default": {"LOCATION": "redis://:s3cret@redis:6379/0"}},
            CELERY_BROKER_URL="redis://:s3cret@redis:6379/1",
            CELERY_RESULT_BACKEND="rediss://:s3cret@redis:6379/2",
        )

    def test_non_redis_backends_are_not_flagged(self):
        assert not self._errors(
            CACHES={"default": {"LOCATION": "identity-test-cache"}},
            CELERY_BROKER_URL="memory://",
            CELERY_RESULT_BACKEND="db+sqlite:///x",
        )


class TestSigningKey:
    @pytest.mark.parametrize(
        "key",
        [
            "short",
            "django-insecure-" + "x" * 60,
            "CHANGE_ME" + "x" * 40,
            "ci-only-insecure-secret-key",
        ],
    )
    def test_weak_or_placeholder_keys_are_an_error(self, key):
        with override_settings(SECRET_KEY=key):
            assert [e.id for e in checks.signing_key_is_not_weak(None)] == ["core.E002"]

    def test_a_long_random_key_passes(self):
        with override_settings(SECRET_KEY="q9Zr7LmVx2Tn4Kb8Wc1Yd6Hf3Jg5Pa0Sz-UeRiOtAyBlNmCvDxEw"):
            assert checks.signing_key_is_not_weak(None) == []


class TestOperatorSurfaceWarnings:
    def test_enabled_surfaces_are_warned_about(self):
        with override_settings(ADMIN_ENABLED=True, API_DOCS_ENABLED=True):
            assert {w.id for w in checks.operator_surfaces_are_off(None)} == {
                "core.W001",
                "core.W002",
            }

        with override_settings(ADMIN_ENABLED=False, API_DOCS_ENABLED=False):
            assert checks.operator_surfaces_are_off(None) == []
