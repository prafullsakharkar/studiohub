"""
Append-only records (TPN review TM-011).

An audit trail that can be edited or deleted by the code that writes it proves little. The model
refuses ``save()`` on an existing row and ``delete()``; on PostgreSQL a trigger (migration
``0002_project_scope_and_append_only``) refuses ``UPDATE`` and ``DELETE`` in SQL too, so a queryset
``update()`` or a shell session cannot rewrite history either. The only way out is the retention job
(``services/retention.py``), which deletes whole rows past their retention period inside a
transaction that announces it to the trigger.
"""

from __future__ import annotations

from django.db import models


class ImmutableRecordError(RuntimeError):
    """An audit record was asked to change or disappear."""


class AppendOnlyModel(models.Model):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableRecordError(
                f"{type(self).__name__} is append-only: a recorded row cannot be changed."
            )

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError(
            f"{type(self).__name__} is append-only: a recorded row cannot be deleted "
            "(retention removes expired rows)."
        )
