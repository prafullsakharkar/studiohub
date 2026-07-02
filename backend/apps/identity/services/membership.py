from django.db import transaction

from apps.core.events import EventBus
from apps.identity.choices import MembershipStatus
from apps.identity.events.membership import (
    MembershipActivated,
    MembershipArchived,
    MembershipCreated,
    MembershipDeleted,
    MembershipRestored,
    MembershipSuspended,
    MembershipUpdated,
)
from apps.identity.models import OrganizationMembership
from apps.identity.services.base import IdentityBaseService


class MembershipService(IdentityBaseService):

    model = OrganizationMembership

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):

        membership = cls.create_instance(
            **validated_data,
        )

        EventBus.publish(
            MembershipCreated(
                instance=membership,
            )
        )

        return membership

    @classmethod
    @transaction.atomic
    def update(
        cls,
        instance,
        **validated_data,
    ):

        membership = cls.update_instance(
            instance,
            **validated_data,
        )

        EventBus.publish(
            MembershipUpdated(
                instance=membership,
            )
        )

        return membership

    @classmethod
    @transaction.atomic
    def activate(
        cls,
        instance,
    ):

        instance.status = MembershipStatus.ACTIVE
        instance.save(update_fields=["status"])

        EventBus.publish(
            MembershipActivated(
                instance=instance,
            )
        )

        return instance

    @classmethod
    @transaction.atomic
    def suspend(
        cls,
        instance,
    ):

        instance.status = MembershipStatus.SUSPENDED
        instance.save(update_fields=["status"])

        EventBus.publish(
            MembershipSuspended(
                instance=instance,
            )
        )

        return instance

    @classmethod
    @transaction.atomic
    def archive(cls, instance):

        cls.archive_instance(instance)

        EventBus.publish(MembershipArchived(instance=instance))

        return instance

    @classmethod
    @transaction.atomic
    def restore(cls, instance):

        cls.restore_instance(instance)

        EventBus.publish(MembershipRestored(instance=instance))

        return instance

    @classmethod
    @transaction.atomic
    def delete(cls, instance):

        cls.delete_instance(instance)

        EventBus.publish(MembershipDeleted(instance=instance))
