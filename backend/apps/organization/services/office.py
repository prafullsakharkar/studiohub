from django.db import transaction

from apps.core.events import EventBus
from apps.organization.events.office import (
    OfficeArchived,
    OfficeCreated,
    OfficeDeleted,
    OfficeHeadquartersChanged,
    OfficeManagerAssigned,
    OfficeRestored,
    OfficeUpdated,
)
from apps.organization.models.office import Office
from apps.organization.services.base import OrganizationBaseService


class OfficeService(OrganizationBaseService):
    """
    Business operations for Office.
    """

    model = Office

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):
        office = cls.create_instance(**validated_data)

        EventBus.publish(OfficeCreated(instance=office))

        return office

    @classmethod
    @transaction.atomic
    def update(cls, instance, **validated_data):
        office = cls.update_instance(
            instance,
            **validated_data,
        )

        EventBus.publish(OfficeUpdated(instance=office))

        return office

    @classmethod
    @transaction.atomic
    def archive(cls, instance):
        cls.archive_instance(instance)

        EventBus.publish(OfficeArchived(instance=instance))

        return instance

    @classmethod
    @transaction.atomic
    def restore(cls, instance):
        cls.restore_instance(instance)

        EventBus.publish(OfficeRestored(instance=instance))

        return instance

    @classmethod
    @transaction.atomic
    def delete(cls, instance):
        cls.delete_instance(instance)

        EventBus.publish(OfficeDeleted(instance=instance))
