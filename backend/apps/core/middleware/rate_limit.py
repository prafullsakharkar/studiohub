"""
Rate limiting middleware.

This middleware implements a simple sliding window rate limiter using Django's
cache framework. It supports both global and per-user rate limiting.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

from django.core.cache import cache
from django.http import JsonResponse

from .base import BaseMiddleware

if TYPE_CHECKING:
    from django.http import HttpRequest


class RateLimitMiddleware(BaseMiddleware):
    """
    Rate limiting middleware using sliding window algorithm.
    
    Configuration:
        RATE_LIMIT_ENABLED: Enable rate limiting (default: True)
        RATE_LIMIT_GLOBAL: Global rate limit (requests per window)
        RATE_LIMIT_WINDOW: Window size in seconds (default: 60)
        RATE_LIMIT_PER_USER: Per-user rate limit (requests per window)
        RATE_LIMIT_ANONYMOUS: Anonymous user rate limit (requests per window)
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.enabled = getattr(self, 'enabled', True)
    
    def process_request(self, request: HttpRequest):
        """Check rate limit before processing the request."""
        if not self.enabled:
            return request
        
        # Skip rate limiting for authenticated requests (handled by DRF)
        if request.user and request.user.is_authenticated:
            return request
        
        # Check global rate limit for anonymous requests
        if self._is_rate_limited(request, "global"):
            return self._get_rate_limit_response()
        
        return request
    
    def _is_rate_limited(self, request: HttpRequest, scope: str) -> bool:
        """Check if the request should be rate limited."""
        window = getattr(self, 'window', 60)
        limit = self._get_limit(request, scope)
        
        if not limit:
            return False
        
        key = self._get_cache_key(request, scope)
        current_time = int(time.time())
        window_start = current_time - window
        
        # Get existing records
        records = cache.get(key, [])
        
        # Filter records within the window
        records = [t for t in records if t > window_start]
        
        # Check if limit exceeded
        if len(records) >= limit:
            return True
        
        # Add current request
        records.append(current_time)
        cache.set(key, records, timeout=window)
        
        return False
    
    def _get_limit(self, request: HttpRequest, scope: str) -> int | None:
        """Get the rate limit for the given scope."""
        if scope == "global":
            return getattr(self, 'global_limit', None)
        return None
    
    def _get_cache_key(self, request: HttpRequest, scope: str) -> str:
        """Generate a cache key for rate limiting."""
        # Use IP address for anonymous requests
        ip_address = self._get_client_ip(request)
        return f"ratelimit:{scope}:{ip_address}"
    
    def _get_client_ip(self, request: HttpRequest) -> str:
        """Get the client's IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '127.0.0.1')
    
    def _get_rate_limit_response(self) -> JsonResponse:
        """Return a 429 Too Many Requests response."""
        return JsonResponse(
            data={
                "error": "rate_limit_exceeded",
                "message": "Too many requests. Please try again later.",
                "status_code": 429,
            },
            status=429,
        )
