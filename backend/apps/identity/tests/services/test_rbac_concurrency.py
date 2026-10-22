"""
Concurrent writers on the RBAC link tables (real threads, real transactions).

Needs ``transaction=True`` so each thread owns a committed connection; the
unique constraints are the arbiter and the services must absorb the loser.
"""

from __future__ import annotations

import threading

import pytest
from django.db import connection, connections

from apps.identity.models import Group, GroupMember, Role, UserRole
from apps.identity.services.rbac import GroupService, RoleService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions


def _race(workers):
    barrier = threading.Barrier(len(workers))
    errors: list[BaseException] = []

    def run(work):
        try:
            barrier.wait(timeout=10)
            work()
        except BaseException as exc:  # noqa: BLE001 - surfaced by the assertion
            errors.append(exc)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=run, args=(w,)) for w in workers]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    return errors


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor == "sqlite",
    reason="SQLite serializes writers; the race is only meaningful on PostgreSQL",
)
class TestConcurrentAssignment:
    def test_same_role_assigned_twice_concurrently(self):
        actor_a = UserFactory.create()
        actor_b = UserFactory.create()
        target = UserFactory.create()
        role = Role.objects.create(name="Race Role", code="race-role")
        grant_permissions(actor_a, "shot.probe.race")
        grant_permissions(actor_b, "shot.probe.race")

        errors = _race(
            [
                lambda: RoleService.assign_user(role=role, user=target, actor=actor_a),
                lambda: RoleService.assign_user(role=role, user=target, actor=actor_b),
            ]
        )

        assert errors == []
        assert UserRole.all_objects.filter(user=target, role=role).count() == 1
        assert UserRole.objects.filter(user=target, role=role, is_deleted=False).exists()

    def test_same_member_added_twice_concurrently(self):
        actor_a = UserFactory.create()
        actor_b = UserFactory.create()
        target = UserFactory.create()
        group = Group.objects.create(name="Race Group", code="race-group")

        errors = _race(
            [
                lambda: GroupService.add_member(group=group, user=target, actor=actor_a),
                lambda: GroupService.add_member(group=group, user=target, actor=actor_b),
            ]
        )

        assert errors == []
        assert GroupMember.all_objects.filter(group=group, user=target).count() == 1
