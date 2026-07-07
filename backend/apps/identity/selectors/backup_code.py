from apps.identity.models import BackupCode
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class BackupCodeSelector(IdentityBaseSelector):
    model = BackupCode

    @classmethod
    def get_available(cls, user):
        return BackupCode.objects.available().by_user(user)

    @classmethod
    def get_unused_count(cls, user):
        return BackupCode.objects.available().by_user(user).count()

    @classmethod
    def get_by_hash(cls, code_hash):
        return BackupCode.objects.filter(code_hash=code_hash).first()
