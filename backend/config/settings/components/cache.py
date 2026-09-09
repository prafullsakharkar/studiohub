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

CACHE_TTL = 60 * 15  # 15 minutes default TTL

# API Response Caching Configuration
API_RESPONSE_CACHE_ENABLED = True
API_RESPONSE_CACHE_DEFAULT_TIMEOUT = 300  # 5 minutes
API_RESPONSE_CACHE_INCLUDE_PARAMS = ["page", "page_size", "search", "ordering"]
