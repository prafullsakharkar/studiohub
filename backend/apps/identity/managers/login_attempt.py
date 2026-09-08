from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.login_attempt import LoginAttemptQuerySet


class LoginAttemptManager(BaseManager):
    """Typed manager exposing LoginAttemptQuerySet helpers."""

    def get_queryset(self) -> LoginAttemptQuerySet:
        return LoginAttemptQuerySet(self.model, using=self._db)

    def successful(self, *args: Any, **kwargs: Any):
        return self.get_queryset().successful(*args, **kwargs)

    def failed(self, *args: Any, **kwargs: Any):
        return self.get_queryset().failed(*args, **kwargs)

    def for_username(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_username(*args, **kwargs)

    def for_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_user(*args, **kwargs)

    def by_reason(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_reason(*args, **kwargs)

    def ip_address(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ip_address(*args, **kwargs)

    def recent(self, *args: Any, **kwargs: Any):
        return self.get_queryset().recent(*args, **kwargs)

    def expired(self, *args: Any, **kwargs: Any):
        return self.get_queryset().expired(*args, **kwargs)

    def list_login_attempts(self, *args: Any, **kwargs: Any):
        return self.get_queryset().list_login_attempts(*args, **kwargs)

    def count_login_attempts(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_login_attempts(*args, **kwargs)

    def get_login_attempt_with_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_login_attempt_with_user(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def system(self, *args: Any, **kwargs: Any):
        return self.get_queryset().system(*args, **kwargs)

    def custom(self, *args: Any, **kwargs: Any):
        return self.get_queryset().custom(*args, **kwargs)

    def by_name(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_name(*args, **kwargs)

    def by_code(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_code(*args, **kwargs)

    def get_by_id(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_by_id(*args, **kwargs)

    def count_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_all(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
