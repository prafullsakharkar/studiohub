from __future__ import annotations

from django.db import models

from apps.organization.querysets.user_preference import (
    UserPreferenceQuerySet,
)


class UserPreferenceManager(models.Manager.from_queryset(UserPreferenceQuerySet)):
    """
    Manager for UserPreference model.
    """
