"""
Change Log choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class ChangeType(models.TextChoices):
    """
    Change types.
    """
    
    CREATE = "create", _("Create")
    UPDATE = "update", _("Update")
    DELETE = "delete", _("Delete")
