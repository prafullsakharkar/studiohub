"""
CRUD service.
"""

from __future__ import annotations

from django.db import transaction

from .base import BaseService


class CRUDService(BaseService):
    """
    Generic CRUD operations.
    """

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):

        cls.before_create(**validated_data)

        instance = cls.model.objects.create(
            **validated_data,
        )

        return cls.after_create(instance)

    @classmethod
    @transaction.atomic
    def update(
        cls,
        instance,
        **validated_data,
    ):

        cls.before_update(
            instance,
            **validated_data,
        )

        for field, value in validated_data.items():
            setattr(
                instance,
                field,
                value,
            )

        instance.save()

        return cls.after_update(instance)

    @classmethod
    @transaction.atomic
    def delete(
        cls,
        instance,
    ):

        cls.before_delete(instance)

        instance.delete()

        cls.after_delete(instance)
