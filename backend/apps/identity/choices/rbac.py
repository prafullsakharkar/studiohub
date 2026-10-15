from django.db import models


class RolePriority(models.IntegerChoices):
    """
    Role priority choices for platform roles.
    """

    ADMIN = 10, "Admin"
    MANAGER = 20, "Manager"
    LEAD = 30, "Lead"
    MEMBER = 40, "Member"
    GUEST = 50, "Guest"
    VIEWER = 60, "Viewer"


class RoleScope(models.TextChoices):
    """
    Role scope choices for platform roles.

    Canonical scope lattice (ADR-0033 D1/D2): a role's scope is the ceiling
    of where its granted permissions may apply.
    """

    ORGANIZATION = "organization", "Organization"
    PROJECT = "project", "Project"
    SHOW = "show", "Show"
    DEPARTMENT = "department", "Department"
    TEAM = "team", "Team"
    OFFICE = "office", "Office"


class RoleType(models.TextChoices):
    """
    Role type choices for platform roles.
    """

    ORGANIZATION = "organization", "Organization"
    DEPARTMENT = "department", "Department"
    TEAM = "team", "Team"
    OFFICE = "office", "Office"


class PermissionModule(models.TextChoices):
    """
    Permission module choices for platform permissions.
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
    MEMBERSHIP = "membership", "Membership"
    API_KEY = "api_key", "API Key"
    PERSONAL_ACCESS_TOKEN = "personal_access_token", "Personal Access Token"


class PermissionAction(models.TextChoices):
    """
    Permission action choices for platform permissions.
    """

    VIEW = "view", "View"
    CREATE = "create", "Create"
    UPDATE = "update", "Update"
    DELETE = "delete", "Delete"
    MANAGE = "manage", "Manage"
    ASSIGN = "assign", "Assign"
    APPROVE = "approve", "Approve"
    REJECT = "reject", "Reject"
    PUBLISH = "publish", "Publish"
    ARCHIVE = "archive", "Archive"
    RESTORE = "restore", "Restore"
    ACTIVATE = "activate", "Activate"
    DEACTIVATE = "deactivate", "Deactivate"
    EXPORT = "export", "Export"
    IMPORT = "import", "Import"


class PermissionCategory(models.TextChoices):
    """
    Permission category choices for platform permissions.
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
    MEMBERSHIPS = "memberships", "Memberships"
    API_KEYS = "api_keys", "API Keys"
    ACCESS_TOKENS = "access_tokens", "Access Tokens"
