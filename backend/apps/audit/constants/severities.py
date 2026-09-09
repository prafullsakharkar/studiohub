"""
Audit Severity codes for event priority.
"""
from __future__ import annotations


class AuditSeverityCodes:
    """
    Standard audit severity codes.
    """
    
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"
    
    ALL = [
        DEBUG,
        INFO,
        WARNING,
        ERROR,
        CRITICAL,
    ]
    
    DESCRIPTIONS = {
        DEBUG: "Debug level event",
        INFO: "Informational event",
        WARNING: "Warning event",
        ERROR: "Error event",
        CRITICAL: "Critical event",
    }
    
    COLORS = {
        DEBUG: "#6B7280",
        INFO: "#3B82F6",
        WARNING: "#F59E0B",
        ERROR: "#EF4444",
        CRITICAL: "#DC2626",
    }
