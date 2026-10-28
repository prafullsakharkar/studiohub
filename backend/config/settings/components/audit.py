"""
Audit retention (TPN review TM-011): how long each audit table keeps its rows. 0 keeps them.
"""

from config.env import settings

AUDIT_RETENTION_DAYS = settings.audit_retention_days

API_REQUEST_RETENTION_DAYS = settings.api_request_retention_days

TRACK_RETENTION_DAYS = settings.track_retention_days
