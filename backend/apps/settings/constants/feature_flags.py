"""
Feature Flag codes for standard feature flags.
"""
from __future__ import annotations


class FeatureFlagCodes:
    """
    Standard feature flag codes.
    
    These codes are used to identify and reference feature flags
    throughout the application.
    """
    
    # Project Features
    PROJECT_TEMPLATES = "project_templates"

    # Production Features
    VERSION_AUTO_PUBLISH = "version_auto_publish"
    REVIEW_ANNOTATIONS = "review_annotations"
    PLAYLIST_SHARING = "playlist_sharing"
    WORKFLOW_AUTOMATION = "workflow_automation"

    # Notification Features
    NOTIFICATION_EMAIL = "notification_email"
    NOTIFICATION_SMS = "notification_sms"
    NOTIFICATION_PUSH = "notification_push"

    # Media Features
    MEDIA_PROXY_GENERATION = "media_proxy_generation"
    MEDIA_AUTO_TRANSCODE = "media_auto_transcode"

    # Delivery Features
    DELIVERY_TRACKING = "delivery_tracking"

    # Billing Features
    BILLING_ONLINE_PAYMENT = "billing_online_payment"
    BILLING_INVOICE = "billing_invoice"
    BILLING_SUBSCRIPTION = "billing_subscription"

    # Analytics Features
    ANALYTICS_DASHBOARD = "analytics_dashboard"
    ANALYTICS_EXPORT = "analytics_export"
    ANALYTICS_REPORTS = "analytics_reports"

    # AI Features
    AI_SEARCH = "ai_search"
    AI_INSIGHTS = "ai_insights"
    AI_AUTOMATION = "ai_automation"

    # Video Features
    VIDEO_REVIEW = "video_review"
    VIDEO_PROXY_GENERATION = "video_proxy_generation"
    VIDEO_AUTO_TRANSCODE = "video_auto_transcode"

    # User Features
    USER_PROFILE_PRIVATE = "user_profile_private"
    USER_API_TOKENS = "user_api_tokens"
    USER_TEAMS = "user_teams"

    # Admin Features
    ADMIN_DASHBOARD = "admin_dashboard"
    ADMIN_SETTINGS = "admin_settings"
    ADMIN_AUDIT_LOG = "admin_audit_log"

    ALL = [
        PROJECT_TEMPLATES,
        VERSION_AUTO_PUBLISH,
        REVIEW_ANNOTATIONS,
        PLAYLIST_SHARING,
        WORKFLOW_AUTOMATION,
        NOTIFICATION_EMAIL,
        NOTIFICATION_SMS,
        NOTIFICATION_PUSH,
        MEDIA_PROXY_GENERATION,
        MEDIA_AUTO_TRANSCODE,
        DELIVERY_TRACKING,
        BILLING_ONLINE_PAYMENT,
        BILLING_INVOICE,
        BILLING_SUBSCRIPTION,
        ANALYTICS_DASHBOARD,
        ANALYTICS_EXPORT,
        ANALYTICS_REPORTS,
        AI_SEARCH,
        AI_INSIGHTS,
        AI_AUTOMATION,
        VIDEO_REVIEW,
        VIDEO_PROXY_GENERATION,
        VIDEO_AUTO_TRANSCODE,
        USER_PROFILE_PRIVATE,
        USER_API_TOKENS,
        USER_TEAMS,
        ADMIN_DASHBOARD,
        ADMIN_SETTINGS,
        ADMIN_AUDIT_LOG,
    ]
