"""
Structured diagnostic event names (ADR-0022, ADR-0031).

Single source of truth for the ``event`` field emitted by the request
lifecycle middleware, the DRF exception handler, and infrastructure
diagnostics. Event names are stable: tests, dashboards, and alerts may
match on them.
"""

from __future__ import annotations

# Request lifecycle.
REQUEST_STARTED = "request_started"
REQUEST_COMPLETED = "request_completed"

# Authentication (401).
AUTHENTICATION_SUCCESS = "authentication_success"
AUTHENTICATION_FAILED = "authentication_failed"

# Authorization (403).
PERMISSION_GRANTED = "permission_granted"
PERMISSION_DENIED = "permission_denied"

# Routing.
METHOD_NOT_ALLOWED = "method_not_allowed"
NOT_FOUND = "not_found"

# Validation (400).
VALIDATION_ERROR = "validation_error"

# Throttling (429) and cache infrastructure.
THROTTLED = "throttled"
CACHE_ERROR = "cache_error"
THROTTLE_CACHE_FALLBACK = "throttle_cache_fallback"

# Infrastructure failures.
DATABASE_ERROR = "database_error"
EXTERNAL_SERVICE_ERROR = "external_service_error"

# Unexpected failures (500).
UNHANDLED_EXCEPTION = "unhandled_exception"
