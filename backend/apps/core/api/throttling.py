"""
Resilient DRF throttles.

Matches the PermissionCacheService philosophy: degraded rate limiting is
better than 500ing the endpoint. Login must survive cache (Redis) outages.
"""

from rest_framework.throttling import ScopedRateThrottle

from apps.core.logging.logger import get_logger


class ResilientScopedRateThrottle(ScopedRateThrottle):
    """
    ScopedRateThrottle that fails open when the cache backend is down.

    Without this, a Redis outage turns every throttled endpoint (login,
    refresh) into a 500, since DRF throttles do not handle cache errors.
    """

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            get_logger("throttling").warning(
                "throttle_cache_unavailable",
                scope=getattr(
                    view,
                    getattr(self, "scope_attr", "throttle_scope"),
                    None,
                ),
            )

            return True
