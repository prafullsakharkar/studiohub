"""
Error Type codes for categorizing errors.
"""
from __future__ import annotations


class ErrorTypeCodes:
    """
    Standard error type codes.
    """
    
    EXCEPTION = "exception"
    API_ERROR = "api_error"
    DATABASE_ERROR = "database_error"
    CACHE_ERROR = "cache_error"
    FILE_ERROR = "file_error"
    AUTH_ERROR = "auth_error"
    VALIDATION_ERROR = "validation_error"
    PERMISSION_ERROR = "permission_error"
    NETWORK_ERROR = "network_error"
    OTHER = "other"
    
    ALL = [
        EXCEPTION,
        API_ERROR,
        DATABASE_ERROR,
        CACHE_ERROR,
        FILE_ERROR,
        AUTH_ERROR,
        VALIDATION_ERROR,
        PERMISSION_ERROR,
        NETWORK_ERROR,
        OTHER,
    ]
    
    DESCRIPTIONS = {
        EXCEPTION: "General exception",
        API_ERROR: "API error",
        DATABASE_ERROR: "Database error",
        CACHE_ERROR: "Cache error",
        FILE_ERROR: "File error",
        AUTH_ERROR: "Authentication error",
        VALIDATION_ERROR: "Validation error",
        PERMISSION_ERROR: "Permission error",
        NETWORK_ERROR: "Network error",
        OTHER: "Other error",
    }
