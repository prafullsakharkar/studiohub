from django.db import models


class PermissionAction(models.TextChoices):
    """
    Permission action choices for organization permissions.
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

