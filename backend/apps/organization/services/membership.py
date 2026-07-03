"""
Organization membership write service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.services.business import BusinessService
from apps.organization.events import (
    MembershipAccepted,
    MembershipActivated,
    MembershipArchived,
    MembershipCreated,
    MembershipDeactivated,
    MembershipDeleted,
    MembershipReactivated,
    MembershipRestored,
    MembershipSuspended,
    MembershipUpdated,
)
from apps.organization.models import OrganizationMembership
from apps.organization.validators.membership import (
    OrganizationMembershipValidator,
)


class OrganizationMembershipService(BusinessService):
    """
    Handles all write operations for organization membership.
    """

    model = OrganizationMembership

    validator_class = OrganizationMembershipValidator

    event_map = {
        "create": MembershipCreated,
        "update": MembershipUpdated,
        "delete": MembershipDeleted,
        "restore": MembershipRestored,
        "archive": MembershipArchived,
        "activate": MembershipActivated,
        "deactivate": MembershipDeactivated,
        "accept": MembershipAccepted,
        "suspend": MembershipSuspended,
        "reactivate": MembershipReactivated,
    }

    @classmethod
    @transaction.atomic
    def accept(cls, instance):
        cls.validate(
            "accept",
            instance=instance,
        )

        instance.accept()

        cls.publish_event(
            "accept",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def suspend(cls, instance):
        cls.validate(
            "suspend",
            instance=instance,
        )

        instance.suspend()

        cls.publish_event(
            "suspend",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def reactivate(cls, instance):
        cls.validate(
            "reactivate",
            instance=instance,
        )

        instance.reactivate()

        cls.publish_event(
            "reactivate",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance
