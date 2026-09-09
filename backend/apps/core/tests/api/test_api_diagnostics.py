"""
Tests for centralized API diagnostics (ADR-0031).

Covers HTTP behavior AND log content: every failure must emit one
structured diagnostic record (WARNING for 4xx, ERROR with traceback for
5xx) sharing the ``request_id`` returned to the client, plus a single
``request_completed`` record from the lifecycle middleware.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, force_authenticate
from structlog.testing import capture_logs

from apps.core.api.diagnostics import events
from apps.core.api.diagnostics.reasons import (
    classify_auth_failure,
    classify_cache_error,
    error_code_for,
    sanitize_validation_errors,
)
from apps.core.api.exceptions.handlers import custom_exception_handler
from apps.core.middleware.request_logging import RequestLoggingMiddleware
from apps.identity.tests.factories import UserFactory


def _jwt_for(user) -> str:
    from rest_framework_simplejwt.tokens import RefreshToken

    return str(RefreshToken.for_user(user).access_token)


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(user)}")
    return client


def _audit_logs_url() -> str:
    return reverse("api:v1:audit:audit-log-list")


def _audit_root_url() -> str:
    return "/api/v1/audit/"


def _failed_event(records, event_name):
    matches = [r for r in records if r.get("event") == event_name]
    assert matches, f"no {event_name} record in {[r.get('event') for r in records]}"
    return matches[0]


@pytest.mark.django_db
class TestAuthenticationDiagnostics:
    def test_missing_token_returns_401_with_reason(self):
        with capture_logs() as records:
            response = APIClient().get(_audit_logs_url())

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data["error"]["code"] == "not_authenticated"
        request_id = response.data["error"]["request_id"]
        assert request_id
        assert response["X-Request-ID"] == request_id

        record = _failed_event(records, events.AUTHENTICATION_FAILED)
        assert record["status_code"] == 401
        assert record["reason"] == "missing_credentials"
        assert record["request_id"] == request_id
        assert record["path"] == _audit_logs_url()
        assert record["user_id"] is None
        assert "JWTAuthentication" in record["authentication_classes"]

        # The middleware completion record resolves the same view class
        # from the URL resolver (regression: must be the class name,
        # never "type").
        completion = _failed_event(records, events.REQUEST_COMPLETED)
        assert completion["view"] == "AuditLogViewSet"
        assert completion["view_action"] == "list"
        assert completion["request_id"] == request_id

    def test_invalid_token_returns_401(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer this-is-not-a-jwt")

        with capture_logs() as records:
            response = client.get(_audit_logs_url())

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        record = _failed_event(records, events.AUTHENTICATION_FAILED)
        assert record["reason"] == "invalid_token"
        assert record["has_credentials"] is True
        assert record["auth_scheme"] == "Bearer"

        # The credential itself must never appear in logs.
        blob = str(records)
        assert "this-is-not-a-jwt" not in blob
        assert "Authorization" not in blob

    def test_expired_token_returns_401(self):
        from rest_framework_simplejwt.tokens import AccessToken

        user = UserFactory.create()
        token = AccessToken.for_user(user)
        token.set_exp(lifetime=timedelta(seconds=-1))

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with capture_logs() as records:
            response = client.get(_audit_logs_url())

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        record = _failed_event(records, events.AUTHENTICATION_FAILED)
        assert record["reason"] == "expired_token"

    def test_malformed_token_returns_401(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer")

        with capture_logs() as records:
            response = client.get(_audit_logs_url())

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        record = _failed_event(records, events.AUTHENTICATION_FAILED)
        assert record["reason"] in ("malformed_token", "invalid_token")

    def test_revoked_token_returns_401(self):
        # Access tokens are stateless here (SimpleJWT only blacklists
        # refresh tokens); revoking a refresh token must fail rotation.
        from rest_framework_simplejwt.tokens import RefreshToken

        user = UserFactory.create()
        refresh = RefreshToken.for_user(user)
        refresh.blacklist()

        url = reverse("api:v1:identity:refresh")

        with capture_logs() as records:
            response = APIClient().post(
                url, {"refresh": str(refresh)}, format="json"
            )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        record = _failed_event(records, events.AUTHENTICATION_FAILED)
        assert record["reason"] == "revoked_token"

    def test_unsupported_scheme_returns_401(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Api-Key some-key-material")

        with capture_logs() as records:
            response = client.get(_audit_logs_url())

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        record = _failed_event(records, events.AUTHENTICATION_FAILED)
        assert record["reason"] == "unsupported_authentication_scheme"
        assert "some-key-material" not in str(records)


@pytest.mark.django_db
class TestAuditEndpointRootCauses:
    """
    Regression proofs for the reported ``/api/v1/audit/`` failures.
    """

    def test_unauthenticated_post_returns_401_not_405(self):
        # Authentication runs before method dispatch: without credentials
        # the reported POST fails closed with 401/missing_credentials.
        with capture_logs() as records:
            response = APIClient().post(_audit_root_url(), {}, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        record = _failed_event(records, events.AUTHENTICATION_FAILED)
        assert record["reason"] == "missing_credentials"
        assert record["path"] == "/api/v1/audit/"

    def test_authenticated_post_returns_405_with_allowed_methods(self):
        # The bare path only serves DRF's GET-only API root: audit records
        # are append-only and every audit ViewSet is List+Retrieve-only.
        # Frontend ``recordLog``/mocks assume a writable collection here —
        # that contract mismatch is the 405 root cause.
        user = UserFactory.create(is_staff=True)

        with capture_logs() as records:
            response = _auth_client(user).post(
                _audit_root_url(), {}, format="json"
            )

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        assert response.data["error"]["code"] == "method_not_allowed"

        record = _failed_event(records, events.METHOD_NOT_ALLOWED)
        assert record["requested_method"] == "POST"
        assert "GET" in record["allowed_methods"]
        assert "POST" not in record["allowed_methods"]
        assert record["route"] == "api/v1/audit/"
        assert record["status_code"] == 405
        assert record["request_id"] == response.data["error"]["request_id"]


@pytest.mark.django_db
class TestAuthorizationDiagnostics:
    def test_permission_denied_names_denying_class(self):
        from rest_framework.exceptions import PermissionDenied
        from rest_framework.test import APIRequestFactory

        from apps.core.permissions.base import IsAdminPermission

        user = UserFactory.create(is_staff=False)
        factory = APIRequestFactory()
        django_request = factory.get("/api/v1/example/")
        force_authenticate(django_request, user=user)

        from rest_framework.request import Request

        drf_request = Request(
            django_request,
            parsers=(),
            authenticators=(),
        )

        class StaffOnlyView:
            permission_classes = [IsAdminPermission]

            def get_permissions(self):
                return [permission() for permission in self.permission_classes]

        with capture_logs() as records:
            response = custom_exception_handler(
                PermissionDenied("Admin access required."),
                {"request": drf_request, "view": StaffOnlyView()},
            )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data["error"]["code"] == "permission_denied"

        record = _failed_event(records, events.PERMISSION_DENIED)
        assert "IsAdminPermission" in record["permission_classes"]
        assert record["reason"] == "missing_required_permission"
        assert record["status_code"] == 403


@pytest.mark.django_db
class TestRoutingAndValidationDiagnostics:
    def test_unknown_endpoint_returns_json_404_with_diagnostics(self):
        with capture_logs() as records:
            response = APIClient().get("/api/v1/no-such-endpoint/")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["error"]["code"] == "not_found"
        assert response.json()["error"]["request_id"]

        record = _failed_event(records, events.NOT_FOUND)
        assert record["path"] == "/api/v1/no-such-endpoint/"
        assert record["route"] is None

    def test_login_validation_error_names_fields(self):
        url = reverse("api:v1:identity:login")

        with capture_logs() as records:
            response = APIClient().post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"]["code"] == "validation_error"

        record = _failed_event(records, events.VALIDATION_ERROR)
        assert record["serializer"] == "LoginSerializer"
        assert set(record["fields"]) >= {"email", "password"}
        assert record["error_count"] >= 2
        # Sensitive field values are never logged, only safe messages.
        assert "password" in record["errors"]

    def test_malformed_json_body_returns_400(self):
        url = reverse("api:v1:identity:login")

        with capture_logs() as records:
            response = APIClient().post(
                url, "{not-json", content_type="application/json"
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        record = _failed_event(records, events.VALIDATION_ERROR)
        assert record["reason"] == "malformed_body"

    def test_throttle_exceeded_returns_429(self):
        from unittest.mock import patch

        from django.core.cache import cache

        from apps.core.api.throttling import ResilientScopedRateThrottle

        user = UserFactory.create()
        user.set_password("correct-horse-123")
        user.save(update_fields=["password"])

        url = reverse("api:v1:identity:login")
        payload = {"email": user.email, "password": "correct-horse-123"}

        # DRF binds THROTTLE_RATES at class definition; patch the class
        # attribute directly (override_settings cannot reach it).
        rates = {"login": "2/min", "refresh": "60/min"}
        cache.clear()

        with patch.object(
            ResilientScopedRateThrottle, "THROTTLE_RATES", rates
        ):
            client = APIClient()
            assert client.post(url, payload, format="json").status_code == 200
            assert client.post(url, payload, format="json").status_code == 200

            with capture_logs() as records:
                response = client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert response.data["error"]["code"] == "throttled"

        record = _failed_event(records, events.THROTTLED)
        assert record["throttle_scope"] == "login"
        assert record["status_code"] == 429


class TestThrottleFallbackDiagnostics:
    def test_cache_failure_fails_open_with_structured_log(self):
        from unittest.mock import patch

        from rest_framework.test import APIRequestFactory

        from apps.core.api.throttling import ResilientScopedRateThrottle

        throttle = ResilientScopedRateThrottle()
        view = type("View", (), {"throttle_scope": "login"})()
        request = APIRequestFactory().post("/api/v1/identity/login/")

        with (
            patch.object(
                ResilientScopedRateThrottle,
                "get_cache_key",
                side_effect=ConnectionError("connection refused"),
            ),
            capture_logs() as records,
        ):
            assert throttle.allow_request(request, view) is True

        record = _failed_event(records, events.THROTTLE_CACHE_FALLBACK)
        assert record["operation"] == "throttle_check"
        assert record["scope"] == "login"
        assert record["reason"] == "connection_refused"
        assert record["exception_type"] == "ConnectionError"
        assert record["fallback"] == "allow"


class TestExceptionHandlerDiagnostics:
    def test_unexpected_exception_logs_traceback_and_request_id(self, caplog):
        from rest_framework.views import APIView

        factory = RequestFactory()

        class ExplodingView(APIView):
            authentication_classes = ()
            permission_classes = ()

            def get(self, request):
                raise RuntimeError("kaboom")

        with capture_logs() as records:
            response = ExplodingView.as_view()(factory.get("/api/v1/example/"))

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data["detail"] == "Internal server error."
        assert response.data["error"]["code"] == "internal_server_error"
        assert response.data["error"]["request_id"]
        assert (
            response["X-Request-ID"]
            == response.data["error"]["request_id"]
        )

        record = _failed_event(records, events.UNHANDLED_EXCEPTION)
        assert record["exception_type"] == "RuntimeError"
        assert "kaboom" in (record["exception_message"] or "")
        # structlog preserves exc_info; the stdlib bridge renders it.
        assert isinstance(record.get("exc_info"), BaseException)

    def test_unexpected_exception_renders_traceback(self, caplog):
        import logging

        from rest_framework.views import APIView

        factory = RequestFactory()

        class ExplodingView(APIView):
            authentication_classes = ()
            permission_classes = ()

            def get(self, request):
                raise RuntimeError("kaboom-render")

        with caplog.at_level(logging.ERROR):
            ExplodingView.as_view()(factory.get("/api/v1/example/"))

        assert "Traceback (most recent call last)" in caplog.text
        assert "RuntimeError: kaboom-render" in caplog.text

    def test_integrity_error_maps_to_409_with_database_log(self):
        from django.db import IntegrityError

        with capture_logs() as records:
            response = custom_exception_handler(
                IntegrityError('duplicate key value violates unique constraint "uq_x"'),
                {"request": RequestFactory().get("/")},
            )

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data["error"]["code"] == "conflict"

        record = _failed_event(records, events.DATABASE_ERROR)
        assert record["exception_type"] == "IntegrityError"
        assert record["status_code"] == 409

    def test_envelope_preserves_contract_shapes(self):
        from rest_framework.exceptions import NotFound

        response = custom_exception_handler(
            NotFound("Object not found."),
            {"request": RequestFactory().get("/api/v1/things/")},
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        # Existing keys untouched; diagnostics are purely additive.
        assert response.data["detail"] == "Object not found."
        assert response.data["error"]["code"] == "not_found"


class TestRequestLifecycleMiddleware:
    def _middleware(self, **response_kwargs):
        from django.http import JsonResponse

        def get_response(request):
            return JsonResponse({"ok": True}, **response_kwargs)

        return RequestLoggingMiddleware(get_response)

    def test_success_emits_single_completion_record(self):
        with capture_logs() as records:
            response = self._middleware()(RequestFactory().get("/api/v1/things/"))

        assert response.status_code == 200

        completions = [
            r for r in records if r.get("event") == events.REQUEST_COMPLETED
        ]
        assert len(completions) == 1

        record = completions[0]
        assert record["log_level"] == "info"
        assert record["method"] == "GET"
        assert record["path"] == "/api/v1/things/"
        assert record["status_code"] == 200
        assert record["duration_ms"] >= 0
        assert record["request_id"]

    def test_client_error_completion_is_warning(self):
        with capture_logs() as records:
            self._middleware(status=404)(RequestFactory().get("/missing/"))

        (record,) = [
            r for r in records if r.get("event") == events.REQUEST_COMPLETED
        ]
        assert record["log_level"] == "warning"
        assert record["status_code"] == 404

    def test_unhandled_exception_logs_traceback_and_reraises(self):
        def get_response(request):
            raise ValueError("middleware-boom")

        with capture_logs() as records, pytest.raises(ValueError, match="middleware-boom"):
            RequestLoggingMiddleware(get_response)(
                RequestFactory().get("/api/v1/things/")
            )

        record = _failed_event(records, events.UNHANDLED_EXCEPTION)
        assert isinstance(record.get("exc_info"), BaseException)

    def test_django_handled_errors_propagate_quietly(self):
        from django.http import Http404

        def get_response(request):
            raise Http404("gone")

        with capture_logs() as records, pytest.raises(Http404):
            RequestLoggingMiddleware(get_response)(
                RequestFactory().get("/missing/")
            )

        assert [
            r for r in records if r.get("event") == events.UNHANDLED_EXCEPTION
        ] == []

    def test_client_request_id_is_reused_and_sanitized(self):
        with capture_logs() as records:
            self._middleware()(
                RequestFactory().get(
                    "/api/v1/things/",
                    HTTP_X_REQUEST_ID="client-correlation-1",
                )
            )

        (record,) = [
            r for r in records if r.get("event") == events.REQUEST_COMPLETED
        ]
        assert record["request_id"] == "client-correlation-1"

    def test_malicious_request_id_is_replaced(self):
        with capture_logs() as records:
            self._middleware()(
                RequestFactory().get(
                    "/api/v1/things/",
                    HTTP_X_REQUEST_ID="evil\ninjected: x",
                )
            )

        (record,) = [
            r for r in records if r.get("event") == events.REQUEST_COMPLETED
        ]
        assert "\n" not in record["request_id"]


class TestRequestIDMiddleware:
    def _middleware(self):
        from django.http import JsonResponse

        from apps.core.middleware.request_id import RequestIDMiddleware

        return RequestIDMiddleware(lambda request: JsonResponse({"ok": True}))

    def test_generates_id_and_echoes_header(self):
        response = self._middleware()(RequestFactory().get("/api/v1/things/"))

        assert response["X-Request-ID"]
        assert len(response["X-Request-ID"]) == 36  # uuid4

    def test_reuses_valid_client_id(self):
        response = self._middleware()(
            RequestFactory().get(
                "/api/v1/things/", HTTP_X_REQUEST_ID="caller-123"
            )
        )

        assert response["X-Request-ID"] == "caller-123"

    def test_replaces_blank_client_id(self):
        response = self._middleware()(
            RequestFactory().get("/api/v1/things/", HTTP_X_REQUEST_ID="   ")
        )

        assert response["X-Request-ID"].strip()


class TestServerErrorAndNotFoundViews:
    def test_handler500_includes_request_id(self):
        from config.urls import server_error

        with capture_logs() as records:
            response = server_error(RequestFactory().get("/api/v1/things/"))

        assert response.status_code == 500
        import json

        body = json.loads(response.content)
        assert body["detail"] == "Internal server error."
        assert body["error"]["code"] == "internal_server_error"
        assert body["error"]["request_id"]

        record = _failed_event(records, events.UNHANDLED_EXCEPTION)
        assert record["request_id"] == body["error"]["request_id"]

    def test_handler404_returns_json_envelope(self):
        from config.urls import not_found

        with capture_logs() as records:
            response = not_found(RequestFactory().get("/api/v1/nope/"))

        assert response.status_code == 404
        import json

        body = json.loads(response.content)
        assert body["detail"] == "Not found."
        assert body["error"]["code"] == "not_found"

        record = _failed_event(records, events.NOT_FOUND)
        assert record["path"] == "/api/v1/nope/"


class TestClassifierUnits:
    def test_error_codes_prefer_drf_codes(self):
        from rest_framework.exceptions import (
            MethodNotAllowed,
            PermissionDenied,
        )

        assert (
            error_code_for(MethodNotAllowed("POST"), 405)
            == "method_not_allowed"
        )
        assert (
            error_code_for(PermissionDenied("nope"), 403)
            == "permission_denied"
        )
        assert error_code_for(ValueError("x"), 500) == "internal_server_error"

    def test_validation_summary_redacts_sensitive_fields(self):
        summary = sanitize_validation_errors(
            {"password": ["too short"], "name": ["required"]},
        )

        assert summary["fields"] == ["password", "name"]
        assert summary["errors"]["password"] == ["Invalid value."]
        assert summary["errors"]["name"] == ["required"]

    def test_cache_error_classification(self):
        assert classify_cache_error(ConnectionError("refused")) == (
            "connection_refused"
        )
        assert classify_cache_error(TimeoutError("timed out")) == (
            "connection_timeout"
        )
        assert classify_cache_error(KeyError("k")) == "key_error"
        assert classify_cache_error(RuntimeError("weird")) == "unknown"

    def test_missing_header_classifies_without_request(self):
        from rest_framework.exceptions import NotAuthenticated

        outcome = classify_auth_failure(NotAuthenticated(), None)

        assert outcome["reason"] == "missing_credentials"
        assert outcome["authentication_classes"] == []
        assert outcome["has_credentials"] is False
