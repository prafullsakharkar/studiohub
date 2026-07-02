from django.db import transaction

from apps.core.events import EventBus
from apps.organization.events import (
    OrganizationArchivedEvent,
    OrganizationCreatedEvent,
    OrganizationUpdatedEvent,
)
from apps.organization.models import Organization


class OrganizationService:

    @classmethod
    @transaction.atomic
    def create(cls, **data) -> Organization:

        organization = Organization.objects.create(**data)

        EventBus.publish(
            OrganizationCreatedEvent(
                organization=organization,
            )
        )

        return organization

    @classmethod
    @transaction.atomic
    def update(
        cls,
        organization: Organization,
        **data,
    ) -> Organization:

        for field, value in data.items():
            setattr(organization, field, value)

        organization.save()

        EventBus.publish(
            OrganizationUpdatedEvent(
                organization=organization,
            )
        )

        return organization

    @classmethod
    @transaction.atomic
    def archive(
        cls,
        organization: Organization,
    ) -> Organization:

        organization.archive()

        EventBus.publish(
            OrganizationArchivedEvent(
                organization=organization,
            )
        )

        return organization
