"""
Department write service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.services.business import BusinessService
from apps.organization.events import (
    DepartmentActivated,
    DepartmentArchived,
    DepartmentCreated,
    DepartmentDeactivated,
    DepartmentDeleted,
    DepartmentManagerAssigned,
    DepartmentMoved,
    DepartmentRestored,
    DepartmentUpdated,
)
from apps.organization.models import Department
from apps.organization.validators.department import (
    DepartmentValidator,
)


class DepartmentService(BusinessService):
    """
    Handles all write operations for Department.
    """

    model = Department

    validator_class = DepartmentValidator

    event_map = {
        "create": DepartmentCreated,
        "update": DepartmentUpdated,
        "delete": DepartmentDeleted,
        "restore": DepartmentRestored,
        "activate": DepartmentActivated,
        "deactivate": DepartmentDeactivated,
        "archive": DepartmentArchived,
        "manager_assigned": DepartmentManagerAssigned,
        "moved": DepartmentMoved,
    }

    @classmethod
    @transaction.atomic
    def assign_manager(
        cls,
        instance,
        manager,
    ):
        """
        Assign department manager.
        """
        instance.manager = manager

        instance.save(
            update_fields=[
                "manager",
            ]
        )

        cls.publish_event(
            "assign_manager",
            instance=instance,
            manager=manager,
        )

        return instance

    @classmethod
    @transaction.atomic
    def move(
        cls,
        instance,
        parent,
    ):
        """
        Move department under another parent department.
        """
        instance.parent = parent

        instance.save(
            update_fields=[
                "parent",
            ]
        )

        cls.publish_event(
            "move",
            instance=instance,
            parent=parent,
        )

        return instance
