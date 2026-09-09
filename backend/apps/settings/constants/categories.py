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
    PROJECT = "project"
    MEDIA = "media"
    WORKFLOW = "workflow"
    REVIEW = "review"
    DELIVERY = "delivery"
    NOTIFICATION = "notification"
    BILLING = "billing"
    BRANDING = "branding"
    ANALYTICS = "analytics"
    AI = "ai"
    LOCALIZATION = "localization"
    THEME = "theme"
    SECURITY = "security"

    ALL = [
        GENERAL,
        PROJECT,
        MEDIA,
        WORKFLOW,
        REVIEW,
        DELIVERY,
        NOTIFICATION,
        BILLING,
        BRANDING,
        ANALYTICS,
        AI,
        LOCALIZATION,
        THEME,
        SECURITY,
    ]

    # Category descriptions
    DESCRIPTIONS = {
        GENERAL: "General application settings",
        PROJECT: "Project and production settings",
        MEDIA: "Media and attachment settings",
        WORKFLOW: "Workflow and automation settings",
        REVIEW: "Review and approval settings",
        DELIVERY: "Client delivery settings",
        NOTIFICATION: "Notification settings",
        BILLING: "Billing and payment settings",
        BRANDING: "Branding and appearance settings",
        ANALYTICS: "Analytics and reporting settings",
        AI: "AI and machine learning settings",
        LOCALIZATION: "Localization and internationalization settings",
        THEME: "Theme and appearance settings",
        SECURITY: "Security and access control settings",
    }
