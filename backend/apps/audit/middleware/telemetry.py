"""
API telemetry writer.

Persists one ``APIRequest`` row per API call so the observability pages
show real traffic instead of an always-empty table. Metadata only — no
request/response bodies or headers (size + PII).

Best-effort by design: telemetry must never break or meaningfully slow
the request it observes.
"""

from __future__ import annotations

import contextlib
import time

# Paths that are never telemetry (docs, schema, health, non-API traffic).
_SKIP_PREFIXES = (
    "/api/schema",
    "/api/docs",
    "/api/redoc",
    "/api/health",
    "/health",
    "/admin",
    "/static",
    "/media",
)


def _api_version(path: str) -> str:
    # /api/v1/... -> v1, /api/... -> ""
    parts = path.strip("/").split("/")
    if len(parts) >= 2 and parts[0] == "api":
        return parts[1]
    return ""


def _status_category(status_code: int) -> str:
    if status_code >= 500:
        return "5xx"
    if status_code >= 400:
        return "4xx"
    if status_code >= 300:
        return "3xx"
    return "2xx"


class APITelemetryMiddleware:
    """
    Record API ingress telemetry.

    Place after ``OrganizationMiddleware`` so ``request.organization``
    is resolved. Skips anonymous/system traffic (the organization FK is
    required) and non-API paths.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or ""
        if not path.startswith("/api/v1/") or path.startswith(_SKIP_PREFIXES):
            return self.get_response(request)

        start = time.monotonic()
        response = self.get_response(request)
        elapsed_ms = int((time.monotonic() - start) * 1000)

        # Telemetry must never raise.
        with contextlib.suppress(Exception):
            self._record(request, response, elapsed_ms)
        return response

    def _record(self, request, response, elapsed_ms: int) -> None:
        from apps.audit.models import APIRequest

        user = getattr(request, "user", None)
        organization = getattr(request, "organization", None)
        if organization is None:
            return
        if user is None or not getattr(user, "is_authenticated", False):
            user = None

        status_code = getattr(response, "status_code", 0) or 0
        APIRequest.objects.create(
            method=(request.method or "GET").upper(),
            path=request.path or "/",
            full_path=request.get_full_path()[:2000],
            status_code=status_code,
            status_category=_status_category(status_code),
            response_time_ms=max(elapsed_ms, 0),
            request_size_bytes=int(request.META.get("CONTENT_LENGTH") or 0),
            response_size_bytes=0,
            user=user,
            organization=organization,
            ip_address=self._client_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:1000],
            api_version=_api_version(request.path),
        )

    @staticmethod
    def _client_ip(request) -> str | None:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            return forwarded.split(",")[0].strip()[:45]
        return (request.META.get("REMOTE_ADDR") or None)
