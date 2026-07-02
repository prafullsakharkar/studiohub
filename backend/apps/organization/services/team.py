from django.db import transaction

from apps.core.events import EventBus
from apps.organization.events.team import (
    TeamArchived,
    TeamCreated,
    TeamDeleted,
    TeamDepartmentChanged,
    TeamLeadAssigned,
    TeamUpdated,
)
from apps.organization.models.team import Team
from apps.organization.services.base import OrganizationBaseService


class TeamService(OrganizationBaseService):
    """
    Write operations for Team entity.
    """

    model = Team

    # -----------------------------
    # Create
    # -----------------------------
    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):
        team = cls.model.objects.create(**validated_data)

        EventBus.publish(TeamCreated(instance=team))

        return team

    # -----------------------------
    # Update
    # -----------------------------
    @classmethod
    @transaction.atomic
    def update(cls, instance, **validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        EventBus.publish(TeamUpdated(instance=instance))

        return instance

    # -----------------------------
    # Assign Lead
    # -----------------------------
    @classmethod
    @transaction.atomic
    def assign_lead(cls, instance, user):
        instance.lead = user
        instance.save(update_fields=["lead"])

        EventBus.publish(
            TeamLeadAssigned(
                instance=instance,
                user=user,
            )
        )

        return instance

    # -----------------------------
    # Change Department
    # -----------------------------
    @classmethod
    @transaction.atomic
    def change_department(cls, instance, department):
        instance.department = department
        instance.save(update_fields=["department"])

        EventBus.publish(
            TeamDepartmentChanged(
                instance=instance,
                department=department,
            )
        )

        return instance

    # -----------------------------
    # Archive
    # -----------------------------
    @classmethod
    @transaction.atomic
    def archive(cls, instance):
        instance.archive()

        EventBus.publish(TeamArchived(instance=instance))

        return instance

    # -----------------------------
    # Delete
    # -----------------------------
    @classmethod
    @transaction.atomic
    def delete(cls, instance):
        instance.delete()

        EventBus.publish(TeamDeleted(instance=instance))
