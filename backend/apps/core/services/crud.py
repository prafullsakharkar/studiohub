"""
CRUD service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.events import EventBus
from apps.core.services.base import BaseService


class CRUDService(BaseService):
    """
    CRUD operations service.
    Handles create, read, update, delete operations.
    """

    model = None
    selector_class = None
    event_map = {}

    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"

    @classmethod
    def get_queryset(cls):
        """
        Return the default queryset.
        """
        if cls.selector_class:
            return cls.selector_class.get_queryset()
        return cls.model.objects.all()

    @classmethod
    def get(cls, **filters):
        return cls.get_queryset().get(**filters)

    @classmethod
    def filter(cls, **filters):
        return cls.get_queryset().filter(**filters)

    @classmethod
    def first(cls, **filters):
        return cls.filter(**filters).first()

    @classmethod
    def last(cls, **filters):
        return cls.filter(**filters).last()

    @classmethod
    def exists(cls, **filters):
        return cls.filter(**filters).exists()

    @classmethod
    def count(cls, **filters):
        return cls.filter(**filters).count()

    @classmethod
    def bulk_get(cls, ids, *, field="id"):
        """
        Retrieve multiple objects by a field.
        """
        return cls.filter(**{f"{field}__in": ids})

    @classmethod
    def bulk_exists(cls, ids, *, field="id"):
        """
        Check whether all supplied identifiers exist.
        """
        queryset = cls.bulk_get(ids, field=field)
        return queryset.count() == len(set(ids))

    @classmethod
    def in_bulk(cls, ids, *, field_name="id"):
        """
        Return a mapping of field value -> object.
        """
        return cls.get_queryset().in_bulk(ids, field_name=field_name)

    @classmethod
    def before_create(cls, **validated_data):
        return validated_data

    @classmethod
    def after_create(cls, instance, **kwargs):
        return instance

    @classmethod
    def before_update(cls, instance, **validated_data):
        return instance, validated_data

    @classmethod
    def after_update(cls, instance, **kwargs):
        return instance

    @classmethod
    def before_delete(cls, instance, **kwargs):
        return instance

    @classmethod
    def after_delete(cls, instance, **kwargs):
        return instance

    @classmethod
    @transaction.atomic
    def create(cls, *, user=None, **validated_data):
        validated_data = cls.before_create(**validated_data)
        instance = cls._do_create(user=user, **validated_data)
        instance = cls.after_create(instance, user=user)
        cls._publish_event(cls.CREATE, instance=instance, user=user)
        return instance

    @classmethod
    @transaction.atomic
    def update(cls, instance, *, user=None, **validated_data):
        instance, validated_data = cls.before_update(instance, **validated_data)
        instance = cls._do_update(instance, user=user, **validated_data)
        instance = cls.after_update(instance, user=user)
        cls._publish_event(cls.UPDATE, instance=instance, user=user)
        return instance

    @classmethod
    @transaction.atomic
    def delete(cls, instance, *, user=None):
        instance = cls.before_delete(instance, user=user)
        cls._do_delete(instance, user=user)
        cls.after_delete(instance, user=user)
        cls._publish_event(cls.DELETE, instance=instance, user=user)

    @classmethod
    def _do_create(cls, *, user=None, **validated_data):
        """Internal method to create instance without hooks."""
        instance = cls.model(**validated_data)
        instance.save()
        return instance

    @classmethod
    def _do_update(cls, instance, *, user=None, **validated_data):
        """Internal method to update instance without hooks."""
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance

    @classmethod
    def _do_delete(cls, instance, *, user=None):
        """Internal method to delete instance without hooks."""
        instance.delete()

    @classmethod
    def _publish_event(cls, operation, **kwargs):
        event = cls.event_map.get(operation)
        if event is not None:
            EventBus.publish(event(**kwargs))
