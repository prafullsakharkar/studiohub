"""
Change Log model for tracking data changes.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.identity.models.user import User
from apps.organization.models.organization import Organization


class ChangeLog(EntityModel, TimeStampedModel):
    """
    Change log for tracking data changes.
    
    Captures all data modifications including:
    - Field-level changes
    - Before/after values
    - Change history
    """
    
    # Change types
    CHANGE_CREATE = "create"
    CHANGE_UPDATE = "update"
    CHANGE_DELETE = "delete"
    
    CHANGE_CHOICES = [
        (CHANGE_CREATE, _("Create")),
        (CHANGE_UPDATE, _("Update")),
        (CHANGE_DELETE, _("Delete")),
    ]
    
    change_type = models.CharField(
        max_length=20,
        choices=CHANGE_CHOICES,
        db_index=True,
        help_text="Type of change",
    )
    
    target_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Type of target affected",
    )
    
    target_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="ID of the target affected",
    )
    
    target_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the target affected",
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="change_logs",
        db_index=True,
        help_text="User who made the change",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="change_logs",
        db_index=True,
        help_text="Organization context",
    )
    
    # Before and after values stored as JSON
    before_values = models.JSONField(
        default=dict,
        blank=True,
        help_text="Values before the change",
    )
    
    after_values = models.JSONField(
        default=dict,
        blank=True,
        help_text="Values after the change",
    )
    
    # Changed fields
    changed_fields = models.JSONField(
        default=list,
        blank=True,
        help_text="List of fields that changed",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Description of the change",
    )
    
    class Meta:
        db_table = "change_logs"
        ordering = ("-created_at",)
        verbose_name = "Change Log"
        verbose_name_plural = "Change Logs"
    
    def __str__(self):
        return f"{self.change_type}: {self.target_type} {self.target_id}"
    
    def get_changes(self) -> dict:
        """Get the changes between before and after values."""
        changes = {}
        for field in self.changed_fields:
            before = self.before_values.get(field)
            after = self.after_values.get(field)
            if before != after:
                changes[field] = {"before": before, "after": after}
        return changes
