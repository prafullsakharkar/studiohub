"""PII in masterdata query strings never reaches logs or the APIRequest table (H1)."""

from __future__ import annotations

import logging
import uuid

import pytest
from rest_framework.test import APIClient

from apps.audit.models import APIRequest
from apps.core.logging import redaction
from apps.core.logging.constants import REDACTED
from apps.identity.tests.factories import UserFactory
from apps.masterdata import logging_policy
from apps.masterdata.api.urls import directory_router
from apps.masterdata.selectors.directory import PersonSelector

pytestmark = pytest.mark.django_db

EMAIL = "jane.doe.7391@example.com"
PHONE = "+1-555-0147-7391"
NAME = "Tanaka-Okonkwo-7391"
SECRETS = (EMAIL, PHONE, NAME, "jane.doe.7391", "555-0147-7391")


@pytest.fixture
def client():
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=UserFactory.create())
    return api


def _logged_text(caplog) -> str:
    return "\n".join(f"{r.name} {r.getMessage()} {r.exc_text or ''}" for r in caplog.records)


def _recorded_rows() -> str:
    return "\n".join(f"{r.path} {r.full_path}" for r in APIRequest.objects.all())


def assert_no_secret(text: str, where: str) -> None:
    leaked = [s for s in SECRETS if s in text]
    assert not leaked, f"{leaked} reached {where}"


class TestRegistration:
    def test_every_directory_route_is_registered(self):
        """Drift guard: a route added to the router must be added to the policy."""
        routed = {prefix for prefix, _viewset, _basename in directory_router.registry}
        assert routed == set(logging_policy.DIRECTORY_PATHS)

    @pytest.mark.parametrize("path", logging_policy.DIRECTORY_PATHS)
    def test_each_directory_path_redacts_the_personal_data_parameters(self, path):
        names = redaction.sensitive_names_for_path(f"/api/v1/{path}/")
        assert set(logging_policy.SENSITIVE_QUERY_PARAMS) <= names
        assert {"search", "email", "phone"} <= names

    def test_the_catalog_paths_are_not_affected(self):
        assert (
            redaction.sensitive_names_for_path("/api/v1/platform/master-data/software")
            == frozenset()
        )


class TestLogCapture:
    """The proof: with PII in the query string, no log record and no stored row contains it."""

    def _query(self):
        return f"search={NAME}&email={EMAIL}&phone={PHONE}&status=active"

    def test_a_successful_request(self, client, caplog):
        caplog.set_level(logging.DEBUG)

        response = client.get(f"/api/v1/people/?{self._query()}")

        assert response.status_code == 200
        text = _logged_text(caplog)
        assert "request_completed" in text, (
            "the request log was not captured, the test would prove nothing"
        )
        assert_no_secret(text, "the logs")
        assert_no_secret(_recorded_rows(), "the APIRequest table")
        # Names and non-sensitive values stay, so the logs remain useful for diagnosis.
        assert REDACTED in text and "status" in text and "active" in text
        assert (
            "/api/v1/people/?status=active" in _recorded_rows()
            or "status=active" in _recorded_rows()
        )
        assert f"search={REDACTED}".replace("*", "%2A") in _recorded_rows()

    def test_a_not_found_request(self, client, caplog):
        caplog.set_level(logging.DEBUG)
        response = client.get(f"/api/v1/people/{uuid.uuid4()}/?{self._query()}")
        assert response.status_code == 404
        assert "request_completed" in _logged_text(caplog)
        assert_no_secret(_logged_text(caplog), "the logs")
        assert_no_secret(_recorded_rows(), "the APIRequest table")

    def test_a_bad_filter_value(self, client, caplog):
        caplog.set_level(logging.DEBUG)
        response = client.get(f"/api/v1/people/?department=not-a-uuid&{self._query()}")
        assert response.status_code == 400
        assert_no_secret(_logged_text(caplog), "the logs")
        assert_no_secret(_recorded_rows(), "the APIRequest table")

    def test_an_unauthenticated_request(self, caplog):
        caplog.set_level(logging.DEBUG)
        response = APIClient().get(f"/api/v1/clients/?{self._query()}")
        assert response.status_code == 401
        assert_no_secret(_logged_text(caplog), "the logs")
        assert_no_secret(_recorded_rows(), "the APIRequest table")

    def test_a_server_error_with_its_traceback(self, client, caplog, monkeypatch):
        def boom(cls, **kwargs):
            raise RuntimeError("simulated failure")

        monkeypatch.setattr(PersonSelector, "get_queryset", classmethod(boom))
        caplog.set_level(logging.DEBUG)

        response = client.get(f"/api/v1/people/?{self._query()}")

        assert response.status_code == 500
        text = _logged_text(caplog)
        assert "simulated failure" in text, (
            "the error log was not captured, the test would prove nothing"
        )
        assert_no_secret(text, "the logs (including the traceback)")
        assert_no_secret(_recorded_rows(), "the APIRequest table")

    @pytest.mark.parametrize("path", logging_policy.DIRECTORY_PATHS)
    def test_every_directory_path(self, client, caplog, path):
        caplog.set_level(logging.DEBUG)
        client.get(f"/api/v1/{path}/?search={NAME}&email={EMAIL}&phone={PHONE}")
        assert_no_secret(_logged_text(caplog), f"the logs of /{path}/")
        assert_no_secret(_recorded_rows(), f"the APIRequest table for /{path}/")


class TestScopeStaysNarrow:
    def test_other_paths_are_still_recorded_as_before(self, client, caplog):
        """Redaction is per registered path: catalogs and the rest keep their diagnostics."""
        caplog.set_level(logging.DEBUG)
        client.get("/api/v1/platform/master-data/software?search=maya")
        assert "maya" in _logged_text(caplog)
        assert "search=maya" in _recorded_rows()
