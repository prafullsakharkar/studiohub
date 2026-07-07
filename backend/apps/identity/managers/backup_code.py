from apps.core.managers import BaseManager
from apps.identity.querysets.backup_code import BackupCodeQuerySet


class BackupCodeManager(BaseManager.from_queryset(BackupCodeQuerySet)):
    """Manager for BackupCode."""
