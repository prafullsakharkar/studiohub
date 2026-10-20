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

    Subclasses that must fail CLOSED instead (login/refresh) override
    :attr:`cache_outage_fallback` to ``False`` — see
    :class:`FailClosedScopedRateThrottle`.
    """

    #: Whether a request is allowed when the cache backend is unreachable.
    #: Fail-closed subclasses (login/refresh) set this to ``False``.
    cache_outage_fallback = True

    def get_ident(self, request):
        # REMOTE_ADDR only; DRF's default trusts X-Forwarded-For, which is
        # client-supplied and must not drive rate limiting.
        return request.META.get(
            "REMOTE_ADDR",
            "127.0.0.1",
        )

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
                fallback="allow" if self.cache_outage_fallback else "deny",
            )

            return self.cache_outage_fallback

    def wait(self):
        # When the cache is down, allow_request returns False before DRF's
        # history/now attributes were populated, so the default wait()
        # would raise AttributeError. There is no meaningful retry-after
        # to report while the cache is unreachable — fall back to none.
        if not hasattr(self, "history"):
            return None
        return super().wait()


class FailClosedScopedRateThrottle(ResilientScopedRateThrottle):
    """
    ScopedRateThrottle that fails CLOSED when the cache backend is down.

    Used for login/refresh: a cache outage must not turn authentication
    into an unthrottled brute-force target. The login path itself stays
    up (Django session + DB); only rate limiting degrades to deny.
    """

    cache_outage_fallback = False


def _cache_backend_name() -> str:
    """
    Name of the configured default cache backend (no connection made).
    """

    try:
        from django.core.cache import caches

        return type(caches["default"]).__name__
    except Exception:
        return "unknown"
