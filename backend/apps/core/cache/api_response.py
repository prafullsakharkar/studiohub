"""
API Response Caching utilities.

This module provides utilities for caching API responses to improve performance
and reduce database load. It supports both global and per-request caching.
"""

from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING

from django.core.cache import cache

if TYPE_CHECKING:
    from django.http import HttpRequest, HttpResponse


class APIResponseCache:
    """
    Utility class for caching API responses.
    
    Features:
    - Automatic cache key generation based on request
    - Configurable cache TTL
    - Support for cache invalidation
    """
    
    def __init__(
        self,
        default_timeout: int = 300,  # 5 minutes
        enabled: bool = True,
    ):
        """
        Initialize the API response cache.
        
        Args:
            default_timeout: Default cache timeout in seconds
            enabled: Whether caching is enabled
        """
        self.default_timeout = default_timeout
        self.enabled = enabled
    
    def generate_cache_key(self, request: HttpRequest, suffix: str = "") -> str:
        """
        Generate a cache key based on the request.
        
        Args:
            request: The Django HTTP request
            suffix: Optional suffix for the cache key
            
        Returns:
            Cache key string
        """
        # Get relevant request data for cache key
        path = request.path
        query_params = self._get_query_params_for_cache(request)
        user_id = getattr(request.user, "id", "anonymous") if request.user.is_authenticated else "anonymous"
        
        # Create a hash of the request data
        request_data = {
            "path": path,
            "query_params": query_params,
            "user_id": user_id,
        }
        
        data_hash = hashlib.md5(
            json.dumps(request_data, sort_keys=True).encode()
        ).hexdigest()
        
        return f"api_response:{data_hash}:{suffix}" if suffix else f"api_response:{data_hash}"
    
    def _get_query_params_for_cache(self, request: HttpRequest) -> dict:
        """Get query parameters suitable for cache key generation."""
        # Only include certain query params to avoid cache fragmentation
        # This should be customized based on your API
        include_params = {"page", "page_size", "search", "ordering"}
        
        return {
            key: request.GET.getlist(key)
            for key in include_params
            if key in request.GET
        }
    
    def get(self, key: str) -> dict | None:
        """
        Get a cached response.
        
        Args:
            key: Cache key
            
        Returns:
            Cached response data or None
        """
        if not self.enabled:
            return None
        
        return cache.get(key)
    
    def set(self, key: str, data: dict, timeout: int | None = None) -> bool:
        """
        Cache a response.
        
        Args:
            key: Cache key
            data: Response data to cache
            timeout: Cache timeout in seconds (uses default if not specified)
            
        Returns:
            True if caching was successful
        """
        if not self.enabled:
            return False
        
        timeout = timeout or self.default_timeout
        return cache.set(key, data, timeout=timeout)
    
    def delete(self, key: str) -> bool:
        """
        Delete a cached response.
        
        Args:
            key: Cache key
            
        Returns:
            True if deletion was successful
        """
        if not self.enabled:
            return False
        
        return cache.delete(key)
    
    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all cache entries matching a pattern.
        
        Args:
            pattern: Pattern to match (e.g., "api_response:user:*")
            
        Returns:
            Number of cache entries deleted
        """
        if not self.enabled:
            return 0
        
        # Django's cache framework doesn't support pattern-based deletion natively
        # This would require a custom cache backend or using redis-py directly
        # For now, return 0 as a placeholder
        return 0


# Global cache instance
api_response_cache = APIResponseCache()
