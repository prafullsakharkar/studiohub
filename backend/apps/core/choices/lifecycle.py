"""
Common lifecycle choices.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _


class LifecycleStatus(models.TextChoices):
    """
    Common lifecycle for business entities.
    """

    DRAFT = "draft", _("Draft")

    ACTIVE = "active", _("Active")

    INACTIVE = "inactive", _("Inactive")

    ARCHIVED = "archived", _("Archived")
