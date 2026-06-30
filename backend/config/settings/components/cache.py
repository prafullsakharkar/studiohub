"""
Cache configuration.
"""

from config.env import settings

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": settings.redis_url,
    }
}

CACHE_TTL = 60 * 15
