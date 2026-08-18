from django.db import models


class PermissionModule(models.TextChoices):
    """
    Permission module choices for organization permissions.
    """

    ORGANIZATION = "organization", "Organization"
    DEPARTMENT = "department", "Department"
    TEAM = "team", "Team"
    OFFICE = "office", "Office"
    USER = "user", "User"
    ROLE = "role", "Role"
    PERMISSION = "permission", "Permission"
    GROUP = "group", "Group"
    BRANDING = "branding", "Branding"
    HOLIDAY = "holiday", "Holiday"
    CALENDAR = "calendar", "Calendar"
    WORK_HOURS = "work_hours", "Work Hours"
    POSITION = "position", "Position"
    INVITATION = "invitation", "Invitation"
    MEMBERSHIP = "membership", "Membership"
    API_KEY = "api_key", "API Key"
    PERSONAL_ACCESS_TOKEN = "personal_access_token", "Personal Access Token"

