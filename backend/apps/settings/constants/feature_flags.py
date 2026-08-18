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
    
    # Match Features
    MATCH_AUTO_SCORE = "match_auto_score"
    MATCH_LIVE_UPDATE = "match_live_update"
    MATCH_VIDEO_REVIEW = "match_video_review"
    
    # Tournament Features
    TOURNAMENT_REGISTRATION = "tournament_registration"
    TOURNAMENT_BRACKET = "tournament_bracket"
    TOURNAMENT_LIVE_SCORES = "tournament_live_scores"
    
    # Scoring Features
    SCORING_AUTO_CATCH = "scoring_auto_catch"
    SCORING_AUTO_NO_BALL = "scoring_auto_no_ball"
    SCORING_AUTO_WIDE = "scoring_auto_wide"
    
    # Notification Features
    NOTIFICATION_EMAIL = "notification_email"
    NOTIFICATION_SMS = "notification_sms"
    NOTIFICATION_PUSH = "notification_push"
    
    # Streaming Features
    STREAMING_LIVE = "streaming_live"
    STREAMING_VOD = "streaming_vod"
    STREAMING_MULTI_CAMERA = "streaming_multi_camera"
    
    # Billing Features
    BILLING_ONLINE_PAYMENT = "billing_online_payment"
    BILLING_INVOICE = "billing_invoice"
    BILLING_SUBSCRIPTION = "billing_subscription"
    
    # Analytics Features
    ANALYTICS_DASHBOARD = "analytics_dashboard"
    ANALYTICS_EXPORT = "analytics_export"
    ANALYTICS_REPORTS = "analytics_reports"
    
    # AI Features
    AI_SCORE_PREDICTION = "ai_score_prediction"
    AI_PLAYER_ANALYSIS = "ai_player_analysis"
    AI_MATCH_REVIEW = "ai_match_review"
    
    # Video Features
    VIDEO_REVIEW = "video_review"
    VIDEO_HIGH_LIGHTS = "video_highlights"
    VIDEO_COACH_REVIEW = "video_coach_review"
    
    # User Features
    USER_PROFILE_PRIVATE = "user_profile_private"
    USER_CONTACTS = "user_contacts"
    USER_TEAMS = "user_teams"
    
    # Admin Features
    ADMIN_DASHBOARD = "admin_dashboard"
    ADMIN_SETTINGS = "admin_settings"
    ADMIN_AUDIT_LOG = "admin_audit_log"
    
    ALL = [
        MATCH_AUTO_SCORE,
        MATCH_LIVE_UPDATE,
        MATCH_VIDEO_REVIEW,
        TOURNAMENT_REGISTRATION,
        TOURNAMENT_BRACKET,
        TOURNAMENT_LIVE_SCORES,
        SCORING_AUTO_CATCH,
        SCORING_AUTO_NO_BALL,
        SCORING_AUTO_WIDE,
        NOTIFICATION_EMAIL,
        NOTIFICATION_SMS,
        NOTIFICATION_PUSH,
        STREAMING_LIVE,
        STREAMING_VOD,
        STREAMING_MULTI_CAMERA,
        BILLING_ONLINE_PAYMENT,
        BILLING_INVOICE,
        BILLING_SUBSCRIPTION,
        ANALYTICS_DASHBOARD,
        ANALYTICS_EXPORT,
        ANALYTICS_REPORTS,
        AI_SCORE_PREDICTION,
        AI_PLAYER_ANALYSIS,
        AI_MATCH_REVIEW,
        VIDEO_REVIEW,
        VIDEO_HIGH_LIGHTS,
        VIDEO_COACH_REVIEW,
        USER_PROFILE_PRIVATE,
        USER_CONTACTS,
        USER_TEAMS,
        ADMIN_DASHBOARD,
        ADMIN_SETTINGS,
        ADMIN_AUDIT_LOG,
    ]
