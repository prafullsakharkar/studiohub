"""
Person write service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.services.business import BusinessService
from apps.organization.models import Person

_UNSET = object()


class PersonService(BusinessService):
    model = Person

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):
        # ``user`` is reserved by BusinessService for the acting user, so the
        # serializer passes the linked identity as ``linked_user``.
        linked_user = validated_data.pop("linked_user", _UNSET)
        instance = super().create(**validated_data)
        if linked_user is not _UNSET:
            instance.user = linked_user
            instance.save(update_fields=["user"])
        return instance

    @classmethod
    @transaction.atomic
    def update(cls, instance, **validated_data):
        linked_user = validated_data.pop("linked_user", _UNSET)
        instance = super().update(instance, **validated_data)
        if linked_user is not _UNSET:
            instance.user = linked_user
            instance.save(update_fields=["user"])
        return instance
