"""
Setting Definition codes for standard settings.
"""
from __future__ import annotations


class SettingDefinitionCodes:
    """
    Standard setting definition codes.
    
    These codes are used to identify and reference settings
    throughout the application.
    """
    
    # General Settings
    GENERAL_APP_NAME = "general.app_name"
    GENERAL_APP_URL = "general.app_url"
    GENERAL_SUPPORT_EMAIL = "general.support_email"
    GENERAL_SUPPORT_PHONE = "general.support_phone"
    GENERAL_ADDRESS = "general.address"
    
    # Match Settings
    MATCH_AUTO_SCORE = "match.auto_score"
    MATCH_AUTO_UPDATE = "match.auto_update"
    MATCH_SCORE_HISTORY = "match.score_history"
    MATCH_MATCH_DURATION = "match.match_duration"
    
    # Tournament Settings
    TOURNAMENT_REGISTRATION_OPEN = "tournament.registration_open"
    TOURNAMENT_MAX_TEAMS = "tournament.max_teams"
    TOURNAMENT_PRIZE_POOL = "tournament.prize_pool"
    
    # Scoring Settings
    SCORING_BATTING_POINTS = "scoring.batting_points"
    SCORING_BOWLING_POINTS = "scoring.bowling_points"
    SCORING_FIELDING_POINTS = "scoring.fielding_points"
    
    # Notification Settings
    NOTIFICATION_EMAIL_ENABLED = "notification.email_enabled"
    NOTIFICATION_SMS_ENABLED = "notification.sms_enabled"
    NOTIFICATION_PUSH_ENABLED = "notification.push_enabled"
    
    # Streaming Settings
    STREAMING_PLATFORM = "streaming.platform"
    STREAMING_API_KEY = "streaming.api_key"
    STREAMING_CHANNEL_ID = "streaming.channel_id"
    
    # Billing Settings
    BILLING_CURRENCY = "billing.currency"
    BILLING_TAX_RATE = "billing.tax_rate"
    BILLING_INVOICE_PREFIX = "billing.invoice_prefix"
    
    # Branding Settings
    BRANDING_LOGO = "branding.logo"
    BRANDING_PRIMARY_COLOR = "branding.primary_color"
    BRANDING_SECONDARY_COLOR = "branding.secondary_color"
    
    # Analytics Settings
    ANALYTICS_ENABLED = "analytics.enabled"
    ANALYTICS_GOOGLE_ANALYTICS_ID = "analytics.google_analytics_id"
    ANALYTICS_DATA_RETENTION_DAYS = "analytics.data_retention_days"
    
    # AI Settings
    AI_ENABLED = "ai.enabled"
    AI_API_KEY = "ai.api_key"
    AI_MODEL = "ai.model"
    
    # Video Settings
    VIDEO_MAX_SIZE = "video.max_size"
    VIDEO_FORMATS = "video.formats"
    VIDEO_TRANSCODING = "video.transcoding"
    
    # Localization Settings
    LOCALIZATION_LANGUAGE = "localization.language"
    LOCALIZATION_TIMEZONE = "localization.timezone"
    LOCALIZATION_DATE_FORMAT = "localization.date_format"
    LOCALIZATION_CURRENCY = "localization.currency"
    
    # Theme Settings
    THEME_NAME = "theme.name"
    THEME_COLOR_PALETTE = "theme.color_palette"
    THEME_LAYOUT = "theme.layout"
    
    # Security Settings
    SECURITY_MFA_ENABLED = "security.mfa_enabled"
    SECURITY_PASSWORD_POLICY = "security.password_policy"
    SECURITY_SESSION_TIMEOUT = "security.session_timeout"
    
    ALL = [
        GENERAL_APP_NAME,
        GENERAL_APP_URL,
        GENERAL_SUPPORT_EMAIL,
        GENERAL_SUPPORT_PHONE,
        GENERAL_ADDRESS,
        MATCH_AUTO_SCORE,
        MATCH_AUTO_UPDATE,
        MATCH_SCORE_HISTORY,
        MATCH_MATCH_DURATION,
        TOURNAMENT_REGISTRATION_OPEN,
        TOURNAMENT_MAX_TEAMS,
        TOURNAMENT_PRIZE_POOL,
        SCORING_BATTING_POINTS,
        SCORING_BOWLING_POINTS,
        SCORING_FIELDING_POINTS,
        NOTIFICATION_EMAIL_ENABLED,
        NOTIFICATION_SMS_ENABLED,
        NOTIFICATION_PUSH_ENABLED,
        STREAMING_PLATFORM,
        STREAMING_API_KEY,
        STREAMING_CHANNEL_ID,
        BILLING_CURRENCY,
        BILLING_TAX_RATE,
        BILLING_INVOICE_PREFIX,
        BRANDING_LOGO,
        BRANDING_PRIMARY_COLOR,
        BRANDING_SECONDARY_COLOR,
        ANALYTICS_ENABLED,
        ANALYTICS_GOOGLE_ANALYTICS_ID,
        ANALYTICS_DATA_RETENTION_DAYS,
        AI_ENABLED,
        AI_API_KEY,
        AI_MODEL,
        VIDEO_MAX_SIZE,
        VIDEO_FORMATS,
        VIDEO_TRANSCODING,
        LOCALIZATION_LANGUAGE,
        LOCALIZATION_TIMEZONE,
        LOCALIZATION_DATE_FORMAT,
        LOCALIZATION_CURRENCY,
        THEME_NAME,
        THEME_COLOR_PALETTE,
        THEME_LAYOUT,
        SECURITY_MFA_ENABLED,
        SECURITY_PASSWORD_POLICY,
        SECURITY_SESSION_TIMEOUT,
    ]
