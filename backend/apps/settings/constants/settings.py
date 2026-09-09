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
    
    # Project Settings
    PROJECT_CODE_PREFIX = "project.code_prefix"
    PROJECT_DEFAULT_FPS = "project.default_fps"
    PROJECT_DEFAULT_RESOLUTION = "project.default_resolution"

    # Media Settings
    MEDIA_MAX_UPLOAD_SIZE = "media.max_upload_size"
    MEDIA_ALLOWED_FORMATS = "media.allowed_formats"
    MEDIA_AUTO_TRANSCODE = "media.auto_transcode"

    # Review Settings
    REVIEW_DEFAULT_STATUS = "review.default_status"
    REVIEW_RETENTION_DAYS = "review.retention_days"

    # Delivery Settings
    DELIVERY_EXPIRY_DAYS = "delivery.expiry_days"

    # Notification Settings
    NOTIFICATION_EMAIL_ENABLED = "notification.email_enabled"
    NOTIFICATION_SMS_ENABLED = "notification.sms_enabled"
    NOTIFICATION_PUSH_ENABLED = "notification.push_enabled"

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
        PROJECT_CODE_PREFIX,
        PROJECT_DEFAULT_FPS,
        PROJECT_DEFAULT_RESOLUTION,
        MEDIA_MAX_UPLOAD_SIZE,
        MEDIA_ALLOWED_FORMATS,
        MEDIA_AUTO_TRANSCODE,
        REVIEW_DEFAULT_STATUS,
        REVIEW_RETENTION_DAYS,
        DELIVERY_EXPIRY_DAYS,
        NOTIFICATION_EMAIL_ENABLED,
        NOTIFICATION_SMS_ENABLED,
        NOTIFICATION_PUSH_ENABLED,
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
