"""
Audit Action codes for tracking system events.
"""
from __future__ import annotations


class AuditActionCodes:
    """
    Standard audit action codes.
    """
    
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    PERMISSION_CHANGE = "permission_change"
    ROLE_CHANGE = "role_change"
    IMPORT = "import"
    EXPORT = "export"
    API_CALL = "api_call"
    BACKGROUND_JOB = "background_job"
    ERROR = "error"
    TRACK = "track"
    
    ALL = [
        CREATE,
        UPDATE,
        DELETE,
        LOGIN,
        LOGOUT,
        PERMISSION_CHANGE,
        ROLE_CHANGE,
        IMPORT,
        EXPORT,
        API_CALL,
        BACKGROUND_JOB,
        ERROR,
        TRACK,
    ]
    
    DESCRIPTIONS = {
        CREATE: "Create operation",
        UPDATE: "Update operation",
        DELETE: "Delete operation",
        LOGIN: "User login",
        LOGOUT: "User logout",
        PERMISSION_CHANGE: "Permission change",
        ROLE_CHANGE: "Role change",
        IMPORT: "Data import",
        EXPORT: "Data export",
        API_CALL: "API call",
        BACKGROUND_JOB: "Background job execution",
        ERROR: "Error event",
        TRACK: "User behavior tracking",
    }
