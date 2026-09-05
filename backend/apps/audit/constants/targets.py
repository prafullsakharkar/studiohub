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
    PROJECT = "project"
    SEQUENCE = "sequence"
    SHOT = "shot"
    ASSET = "asset"
    TASK = "task"
    VERSION = "version"
    REVIEW = "review"
    PLAYLIST = "playlist"
    MEDIA = "media"
    WORKFLOW = "workflow"
    DELIVERY = "delivery"
    NOTIFICATION = "notification"
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
        PROJECT,
        SEQUENCE,
        SHOT,
        ASSET,
        TASK,
        VERSION,
        REVIEW,
        PLAYLIST,
        MEDIA,
        WORKFLOW,
        DELIVERY,
        NOTIFICATION,
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
        PROJECT: "Project entity",
        SEQUENCE: "Sequence entity",
        SHOT: "Shot entity",
        ASSET: "Asset entity",
        TASK: "Task entity",
        VERSION: "Version entity",
        REVIEW: "Review entity",
        PLAYLIST: "Playlist entity",
        MEDIA: "Media entity",
        WORKFLOW: "Workflow entity",
        DELIVERY: "Delivery entity",
        NOTIFICATION: "Notification entity",
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
