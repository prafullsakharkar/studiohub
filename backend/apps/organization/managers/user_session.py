from __future__ import annotations

from django.db import models

from apps.organization.querysets.user_session import (
    UserSessionQuerySet,
)


class UserSessionManager(models.Manager.from_queryset(UserSessionQuerySet)):
    """
    Manager for UserSession model.
    """
