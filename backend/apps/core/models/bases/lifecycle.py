from django.db import models

from apps.core.choices.lifecycle import LifecycleStatus


class LifecycleModel(models.Model):
    """
    Adds lifecycle support to a model.
    """

    status = models.CharField(
        max_length=20,
        choices=LifecycleStatus.choices,
        default=LifecycleStatus.ACTIVE,
        db_index=True,
    )

    class Meta:
        abstract = True

    @property
    def is_active(self):
        return self.status == LifecycleStatus.ACTIVE

    @property
    def is_inactive(self):
        return self.status == LifecycleStatus.INACTIVE

    @property
    def is_archived(self):
        return self.status == LifecycleStatus.ARCHIVED

    @property
    def is_draft(self):
        return self.status == LifecycleStatus.DRAFT
