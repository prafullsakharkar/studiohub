"""
Resilient DRF throttles.

Matches the PermissionCacheService philosophy: degraded rate limiting is
better than 500ing the endpoint. Login must survive cache (Redis) outages.
"""

from rest_framework.throttling import ScopedRateThrottle

from apps.core.api.diagnostics import events
from apps.core.api.diagnostics.reasons import classify_cache_error
from apps.core.logging.logger import get_logger


class ResilientScopedRateThrottle(ScopedRateThrottle):
    """
    ScopedRateThrottle that fails open when the cache backend is down.

    Without this, a Redis outage turns every throttled endpoint (login,
    refresh) into a 500, since DRF throttles do not handle cache errors.

    The fallback is logged as a structured ``throttle_cache_fallback``
    record with a classified ``reason`` (connection refused, timeout,
    authentication, ...) so infrastructure failures stay visible instead
    of being silently swallowed.
    """

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception as exc:
            get_logger("throttling").warning(
                events.THROTTLE_CACHE_FALLBACK,
                backend=_cache_backend_name(),
                operation="throttle_check",
                scope=getattr(
                    view,
                    getattr(self, "scope_attr", "throttle_scope"),
                    None,
                ),
                reason=classify_cache_error(exc),
                exception_type=type(exc).__name__,
                fallback="allow",
            )

            return True


def _cache_backend_name() -> str:
    """
    Name of the configured default cache backend (no connection made).
    """

    try:
        from django.core.cache import caches

        return type(caches["default"]).__name__
    except Exception:
        return "unknown"
