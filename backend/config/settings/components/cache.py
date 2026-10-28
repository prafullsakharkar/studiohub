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

if settings.redis_tls and settings.redis_ca_cert:
    # A private CA signed the Redis certificate (TPN review TM-009).
    CACHES["default"]["OPTIONS"] = {"ssl_ca_certs": settings.redis_ca_cert}

CACHE_TTL = 60 * 15  # 15 minutes default TTL

# API Response Caching Configuration
API_RESPONSE_CACHE_ENABLED = True
API_RESPONSE_CACHE_DEFAULT_TIMEOUT = 300  # 5 minutes
API_RESPONSE_CACHE_INCLUDE_PARAMS = ["page", "page_size", "search", "ordering"]
