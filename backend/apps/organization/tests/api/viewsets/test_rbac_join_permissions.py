"""
RBAC join-model permission wiring tests.

Standard update/partial_update/destroy routes on the join viewsets require
the same domain permissions as their custom actions (assign/revoke,
add/remove, grant/revoke). Regular users get 403 (permission check runs
before object resolution); staff pass the permission gate.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.organization.tests.factories import (
    GroupMemberFactory,
    GroupRoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
)

CASES = [
    ("api:v1:organization:user_role-detail", UserRoleFactory),
    ("api:v1:organization:group_member-detail", GroupMemberFactory),
    ("api:v1:organization:group_role-detail", GroupRoleFactory),
    ("api:v1:organization:role_permission-detail", RolePermissionFactory),
]


@pytest.mark.django_db
class TestRBACJoinPermissions:
    @pytest.mark.parametrize("route,factory", CASES)
    def test_update_forbidden_for_regular_user(
        self, authenticated_client, route, factory
    ):
        obj = factory.create()
        response = authenticated_client.put(
            reverse(route, kwargs={"uuid": obj.id}),
            {},
            format="json",
        )
        assert response.status_code == 403

    @pytest.mark.parametrize("route,factory", CASES)
    def test_destroy_forbidden_for_regular_user(
        self, authenticated_client, route, factory
    ):
        obj = factory.create()
        response = authenticated_client.delete(
            reverse(route, kwargs={"uuid": obj.id}),
        )
        assert response.status_code == 403

    @pytest.mark.parametrize("route,factory", CASES)
    def test_staff_passes_permission_gate(self, staff_client, route, factory):
        obj = factory.create()
        response = staff_client.put(
            reverse(route, kwargs={"uuid": obj.id}),
            {},
            format="json",
        )
        assert response.status_code not in (401, 403)
