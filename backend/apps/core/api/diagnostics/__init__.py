"""
Centralized API diagnostics (ADR-0031).

Pure helpers shared by the request lifecycle middleware, the DRF
exception handler, and infrastructure diagnostics. No Django imports at
package scope: safe to import from settings-adjacent code.
"""

from . import events
from .context import (
    auth_scheme,
    build_request_context,
    ensure_request_id,
    sanitize_request_id,
)
from .reasons import (
    allowed_methods,
    attempted_auth_classes,
    classify_auth_failure,
    classify_cache_error,
    denied_permission_classes,
    error_code_for,
    sanitize_validation_errors,
)

__all__ = [
    "allowed_methods",
    "attempted_auth_classes",
    "auth_scheme",
    "build_request_context",
    "classify_auth_failure",
    "classify_cache_error",
    "denied_permission_classes",
    "ensure_request_id",
    "error_code_for",
    "events",
    "sanitize_request_id",
    "sanitize_validation_errors",
]
