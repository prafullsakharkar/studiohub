"""
Audit Target codes for tracking affected entities.
"""
from __future__ import annotations


class AuditTargetCodes:
    """
    Standard audit target codes.
    """
    
    USER = "user"
    ORGANIZATION = "organization"
    TEAM = "team"
    MATCH = "match"
    TOURNAMENT = "tournament"
    SCORING = "scoring"
    NOTIFICATION = "notification"
    STREAMING = "streaming"
    BILLING = "billing"
    BRANDING = "branding"
    ANALYTICS = "analytics"
    AI = "ai"
    VIDEO = "video"
    SETTING = "setting"
    FEATURE_FLAG = "feature_flag"
    THEME = "theme"
    LOCALIZATION = "localization"
    
    ALL = [
        USER,
        ORGANIZATION,
        TEAM,
        MATCH,
        TOURNAMENT,
        SCORING,
        NOTIFICATION,
        STREAMING,
        BILLING,
        BRANDING,
        ANALYTICS,
        AI,
        VIDEO,
        SETTING,
        FEATURE_FLAG,
        THEME,
        LOCALIZATION,
    ]
    
    DESCRIPTIONS = {
        USER: "User entity",
        ORGANIZATION: "Organization entity",
        TEAM: "Team entity",
        MATCH: "Match entity",
        TOURNAMENT: "Tournament entity",
        SCORING: "Scoring entity",
        NOTIFICATION: "Notification entity",
        STREAMING: "Streaming entity",
        BILLING: "Billing entity",
        BRANDING: "Branding entity",
        ANALYTICS: "Analytics entity",
        AI: "AI entity",
        VIDEO: "Video entity",
        SETTING: "Setting entity",
        FEATURE_FLAG: "Feature Flag entity",
        THEME: "Theme entity",
        LOCALIZATION: "Localization entity",
    }
