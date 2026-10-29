"""Query-string redaction used by request logs and the APIRequest record."""

from __future__ import annotations

import pytest
from django.test import RequestFactory

from apps.core.api.diagnostics.context import _sanitized_query_params
from apps.core.logging import redaction
from apps.core.logging.constants import REDACTED


@pytest.fixture(autouse=True)
def isolated_registry(monkeypatch):
    """Tests register their own prefixes; the real registry is left untouched."""
    monkeypatch.setattr(redaction, "_REGISTRY", {})
    redaction.register_sensitive_query_params("/api/v1/people", ["search", "email"])


class TestPathMatching:
    @pytest.mark.parametrize(
        "path",
        ["/api/v1/people", "/api/v1/people/", "/api/v1/people/4f2c/", "/api/v1/people/4f2c/link"],
    )
    def test_the_prefix_covers_itself_and_everything_below_it(self, path):
        assert redaction.sensitive_names_for_path(path) == {"search", "email"}

    @pytest.mark.parametrize(
        "path", ["/api/v1/peoples", "/api/v1/people-x/", "/api/v1/", "/api/v1/clients/"]
    )
    def test_whole_segments_only(self, path):
        assert redaction.sensitive_names_for_path(path) == frozenset()

    def test_registering_twice_merges_the_names(self):
        redaction.register_sensitive_query_params("/api/v1/people/", ["PHONE"])
        assert redaction.sensitive_names_for_path("/api/v1/people/") == {"search", "email", "phone"}


class TestRedactQueryParams:
    def test_values_go_names_stay(self):
        out = redaction.redact_query_params(
            "/api/v1/people/", {"search": "jane", "status": "active"}
        )
        assert out == {"search": REDACTED, "status": "active"}

    def test_lists_keep_their_length(self):
        out = redaction.redact_query_params("/api/v1/people/", {"email": ["a@x.io", "b@x.io"]})
        assert out == {"email": [REDACTED, REDACTED]}

    @pytest.mark.parametrize("name", ["email__icontains", "EMAIL", "Search__exact"])
    def test_lookups_and_case_variants_are_covered(self, name):
        assert redaction.redact_query_params("/api/v1/people/", {name: "x"}) == {name: REDACTED}

    def test_unregistered_paths_are_untouched(self):
        params = {"search": "jane", "email": "a@x.io"}
        assert redaction.redact_query_params("/api/v1/projects/", params) == params


class TestRedactFullPath:
    def test_sensitive_values_are_replaced_in_place_and_the_rest_is_kept(self):
        out = redaction.redact_full_path(
            "/api/v1/people/", "status=active&search=jane%40x.io&department=7&email=a%40x.io&page=2"
        )
        assert "jane" not in out and "a%40x.io" not in out and "a@x.io" not in out
        assert out.startswith("/api/v1/people/?status=active&search=")
        assert "department=7" in out and "page=2" in out

    def test_repeated_parameters_are_each_redacted(self):
        out = redaction.redact_full_path("/api/v1/people/", "email=a%40x.io&email=b%40x.io")
        assert "x.io" not in out and out.count("email=") == 2

    def test_a_blank_value_stays_blank_in_structure(self):
        assert "search=" in redaction.redact_full_path("/api/v1/people/", "search=")

    def test_no_query_string_returns_the_path(self):
        assert redaction.redact_full_path("/api/v1/people/", "") == "/api/v1/people/"

    def test_unregistered_path_is_returned_verbatim(self):
        assert (
            redaction.redact_full_path("/api/v1/projects/", "search=jane")
            == "/api/v1/projects/?search=jane"
        )


class TestStructuredLogContext:
    def _params(self, url):
        request = RequestFactory().get(url)
        return _sanitized_query_params(request)

    def test_registered_path_values_are_redacted_in_the_log_context(self):
        params = self._params("/api/v1/people/?search=jane&email=a@x.io&status=active")
        assert params == {"search": [REDACTED], "email": [REDACTED], "status": ["active"]}

    def test_other_paths_keep_logging_their_parameters(self):
        assert self._params("/api/v1/projects/?search=alpha") == {"search": ["alpha"]}

    def test_the_existing_credential_rule_still_drops_tokens_entirely(self):
        assert self._params("/api/v1/people/?token=abc&search=jane") == {"search": [REDACTED]}
