"""
Bulk operations.
"""

from django.db import transaction


class BulkService:

    @classmethod
    @transaction.atomic
    def bulk_create(
        cls,
        objects,
    ):
        return cls.model.objects.bulk_create(
            objects,
        )

    @classmethod
    @transaction.atomic
    def bulk_update(
        cls,
        objects,
        fields,
    ):
        cls.model.objects.bulk_update(
            objects,
            fields,
        )

    @classmethod
    @transaction.atomic
    def bulk_delete(
        cls,
        queryset,
    ):
        queryset.delete()
