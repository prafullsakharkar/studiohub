from django.db import transaction

from apps.core.events import EventBus
from apps.identity.events.role import (
    RoleArchived,
    RoleCreated,
    RoleDeleted,
    RolePermissionsUpdated,
    RoleRestored,
    RoleUpdated,
)
from apps.identity.models import Role
from apps.identity.services.base import IdentityBaseService


class RoleService(IdentityBaseService):
    """
    Business logic for Role.
    """

    model = Role

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):
        role = cls.create_instance(**validated_data)

        EventBus.publish(RoleCreated(instance=role))

        return role

    @classmethod
    @transaction.atomic
    def update(cls, instance, **validated_data):
        role = cls.update_instance(
            instance,
            **validated_data,
        )

        EventBus.publish(RoleUpdated(instance=role))

        return role

    @classmethod
    @transaction.atomic
    def archive(cls, instance):
        cls.archive_instance(instance)

        EventBus.publish(RoleArchived(instance=instance))

        return instance

    @classmethod
    @transaction.atomic
    def restore(cls, instance):
        cls.restore_instance(instance)

        EventBus.publish(RoleRestored(instance=instance))

        return instance

    @classmethod
    @transaction.atomic
    def delete(cls, instance):
        cls.delete_instance(instance)

        EventBus.publish(RoleDeleted(instance=instance))

    @classmethod
    @transaction.atomic
    def set_permissions(cls, role, permissions):
        role.permissions.set(permissions)

        EventBus.publish(
            RolePermissionsUpdated(
                instance=role,
            )
        )

        return role
