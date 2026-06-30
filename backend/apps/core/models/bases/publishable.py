from __future__ import annotations

from django.db import models


class PublishableModel(models.Model):
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def publish(self):
        from django.utils import timezone

        self.is_published = True
        self.published_at = timezone.now()
        self.save(update_fields=["is_published", "published_at"])

    def unpublish(self):
        self.is_published = False
        self.published_at = None
        self.save(update_fields=["is_published", "published_at"])
