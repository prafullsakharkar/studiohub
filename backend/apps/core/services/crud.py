"""
CRUD service.
"""

from __future__ import annotations

from django.db import transaction

from .base import BaseService


class CRUDService(BaseService):
    """
    Generic CRUD operations.

    ``CRUDService`` performs raw database operations only. Lifecycle hooks
    (``before_create``/``after_create`` etc.) are invoked by
    ``apps.core.services.business.BusinessService`` so they fire exactly
    once per operation.
    """

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):
        return cls.model.objects.create(
            **validated_data,
        )

    @classmethod
    @transaction.atomic
    def update(
        cls,
        instance,
        **validated_data,
    ):
        for field, value in validated_data.items():
            setattr(
                instance,
                field,
                value,
            )

        instance.save()

        return instance

    @classmethod
    @transaction.atomic
    def delete(
        cls,
        instance,
    ):
        instance.delete()
