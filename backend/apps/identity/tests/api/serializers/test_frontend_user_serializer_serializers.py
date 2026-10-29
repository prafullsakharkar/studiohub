"""
Identity frontend_user serializer tests.
"""

from __future__ import annotations

import uuid

import pytest

from apps.identity.api.serializers.frontend_user import serialize_frontend_user
from apps.identity.choices import RolePriority
from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Role,
    UserRole,
)
from apps.identity.tests.factories import UserFactory


def _make_role(name: str, priority: int) -> Role:
    return Role.objects.create(
        name=name,
        code=f"{name.lower()}-{uuid.uuid4().hex[:8]}",
        priority=priority,
        is_active=True,
    )


class TestSerializeFrontendUserRole:
    """Tests for platform-global role selection in the frontend payload."""

    @pytest.mark.django_db
    def test_direct_and_group_roles_union_highest_priority_wins(self):
        """A direct Member grant must not mask a group-conferred Admin role."""
        user = UserFactory.create()
        member_role = _make_role("Member", RolePriority.MEMBER)
        admin_role = _make_role("Admin", RolePriority.ADMIN)
        UserRole.objects.create(user=user, role=member_role)
        group = Group.objects.create(
            code=f"group-{uuid.uuid4().hex[:8]}", name="Admins"
        )
        GroupMember.objects.create(group=group, user=user)
        GroupRole.objects.create(group=group, role=admin_role)

        payload = serialize_frontend_user(user)

        assert payload["role"] == "Admin"

    @pytest.mark.django_db
    def test_payload_has_no_org_fields(self):
        """The frontend payload carries no organization/department fields."""
        user = UserFactory.create()

        payload = serialize_frontend_user(user)

        assert "organization_id" not in payload
        assert "organization_name" not in payload
        assert "department" not in payload
