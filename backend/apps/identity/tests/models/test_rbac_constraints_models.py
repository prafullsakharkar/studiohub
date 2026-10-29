from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction

from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Role,
    RolePermission,
    UserRole,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import ensure_permission


@pytest.mark.django_db
class TestLiveNameUniqueness:
    """DOM-RBAC-02: live Role/Group names are unique, case-insensitively."""

    @pytest.mark.parametrize("model", [Role, Group])
    def test_duplicate_live_name_rejected_case_insensitively(self, model):
        model.objects.create(name="Compositors", code="compositors-a")

        with pytest.raises(IntegrityError), transaction.atomic():
            model.objects.create(name="COMPOSITORS", code="compositors-b")

    @pytest.mark.parametrize("model", [Role, Group])
    def test_name_reusable_after_soft_delete(self, model):
        original = model.objects.create(name="Lighters", code="lighters-a")
        original.is_deleted = True
        original.save(update_fields=["is_deleted"])

        model.objects.create(name="Lighters", code="lighters-b")

        assert model.objects.filter(name="Lighters", is_deleted=False).count() == 1


@pytest.mark.django_db
class TestAssignmentUniqueness:
    def test_user_role_unique(self):
        user = UserFactory.create()
        role = Role.objects.create(name="Unique UR", code="unique-ur")
        UserRole.objects.create(user=user, role=role)

        with pytest.raises(IntegrityError), transaction.atomic():
            UserRole.objects.create(user=user, role=role)

    def test_group_member_unique(self):
        user = UserFactory.create()
        group = Group.objects.create(name="Unique GM", code="unique-gm")
        GroupMember.objects.create(group=group, user=user)

        with pytest.raises(IntegrityError), transaction.atomic():
            GroupMember.objects.create(group=group, user=user)

    def test_group_role_unique(self):
        group = Group.objects.create(name="Unique GR", code="unique-gr")
        role = Role.objects.create(name="Unique GR Role", code="unique-gr-role")
        GroupRole.objects.create(group=group, role=role)

        with pytest.raises(IntegrityError), transaction.atomic():
            GroupRole.objects.create(group=group, role=role)

    def test_role_permission_unique(self):
        role = Role.objects.create(name="Unique RP", code="unique-rp")
        permission = ensure_permission("shot.probe.unique")
        RolePermission.objects.create(role=role, permission=permission)

        with pytest.raises(IntegrityError), transaction.atomic():
            RolePermission.objects.create(role=role, permission=permission)
