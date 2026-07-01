from django.db import models


class PermissionAction(models.TextChoices):
    VIEW = "view", "View"
    CREATE = "create", "Create"
    UPDATE = "update", "Update"
    DELETE = "delete", "Delete"

    APPROVE = "approve", "Approve"
    REJECT = "reject", "Reject"

    ASSIGN = "assign", "Assign"

    EXPORT = "export", "Export"
    IMPORT = "import", "Import"

    PUBLISH = "publish", "Publish"
    ARCHIVE = "archive", "Archive"

    RESTORE = "restore", "Restore"

    LOCK = "lock", "Lock"
    UNLOCK = "unlock", "Unlock"
