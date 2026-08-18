"""
Setting Category codes for organizing settings.
"""
from __future__ import annotations


class SettingCategoryCodes:
    """
    Standard setting category codes.
    
    These codes are used to identify and reference setting categories
    throughout the application.
    """
    
    GENERAL = "general"
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
    LOCALIZATION = "localization"
    THEME = "theme"
    SECURITY = "security"
    
    ALL = [
        GENERAL,
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
        LOCALIZATION,
        THEME,
        SECURITY,
    ]
    
    # Category descriptions
    DESCRIPTIONS = {
        GENERAL: "General application settings",
        MATCH: "Match-related settings",
        TOURNAMENT: "Tournament-related settings",
        SCORING: "Scoring system settings",
        NOTIFICATION: "Notification settings",
        STREAMING: "Streaming settings",
        BILLING: "Billing and payment settings",
        BRANDING: "Branding and appearance settings",
        ANALYTICS: "Analytics and reporting settings",
        AI: "AI and machine learning settings",
        VIDEO: "Video-related settings",
        LOCALIZATION: "Localization and internationalization settings",
        THEME: "Theme and appearance settings",
        SECURITY: "Security and access control settings",
    }
