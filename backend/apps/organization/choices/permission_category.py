from django.db import models


class PermissionCategory(models.TextChoices):
    """
    Permission category choices for organization permissions.
    """

    GENERAL = "general", "General"
    SETTINGS = "settings", "Settings"
    CONTENT = "content", "Content"
    USERS = "users", "Users"
    ROLES = "roles", "Roles"
    PERMISSIONS = "permissions", "Permissions"
    GROUPS = "groups", "Groups"
    BRANDING = "branding", "Branding"
    HOLIDAYS = "holidays", "Holidays"
    CALENDARS = "calendars", "Calendars"
    WORK_HOURS = "work_hours", "Work Hours"
    POSITIONS = "positions", "Positions"
    INVITATIONS = "invitations", "Invitations"
    MEMBERSHIPS = "memberships", "Memberships"
    API_KEYS = "api_keys", "API Keys"
    ACCESS_TOKENS = "access_tokens", "Access Tokens"

