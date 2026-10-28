"""
Browser security headers on application responses (TPN review TM-023).

The proxy is authoritative in production and hides these; the application sends them too, so a
deployment without that proxy is not left bare.
"""

from __future__ import annotations

import pytest
from django.http import HttpResponse, JsonResponse
from django.test import RequestFactory

from apps.core.middleware.security import SecurityHeadersMiddleware


def _through(response):
    middleware = SecurityHeadersMiddleware(lambda request: response)
    return middleware(RequestFactory().get("/"))


class TestHeaders:
    def test_a_json_response_gets_the_full_set(self):
        response = _through(JsonResponse({"ok": True}))

        assert response["X-Content-Type-Options"] == "nosniff"
        assert response["X-Frame-Options"] == "DENY"
        assert response["Referrer-Policy"]
        assert "camera=()" in response["Permissions-Policy"]
        assert response["Content-Security-Policy"].startswith("default-src 'none'")
        assert "frame-ancestors 'none'" in response["Content-Security-Policy"]

    def test_a_file_response_is_covered_too(self):
        response = _through(HttpResponse(b"%PDF", content_type="application/pdf"))

        assert "default-src 'none'" in response["Content-Security-Policy"]

    def test_an_html_page_is_left_without_a_policy(self):
        response = _through(HttpResponse("<p>x</p>", content_type="text/html"))

        assert "Content-Security-Policy" not in response
        assert response["X-Content-Type-Options"] == "nosniff"

    def test_a_policy_the_view_already_set_is_kept(self):
        original = HttpResponse(b"x", content_type="application/octet-stream")
        original["Content-Security-Policy"] = "default-src 'none'; sandbox"

        assert _through(original)["Content-Security-Policy"] == "default-src 'none'; sandbox"


@pytest.mark.django_db
def test_a_real_api_response_carries_them(client):
    response = client.get("/health/")

    assert response["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'none'" in response["Content-Security-Policy"]
