"""CR-59: a deleted role or group is gone from every route, and its code can be used again."""

from __future__ import annotations

import importlib

import pytest
from django.apps import apps as django_apps
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.identity.models import Group, GroupRole, Permission, Role, SecurityEvent, UserRole
from apps.identity.services.permission_cache import PermissionCacheService
from apps.identity.tests.factories import UserFactory

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("seeded_platform_module")]

ROLES = "/api/v1/roles/"
GROUPS = "/api/v1/groups/"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def actor():
    return UserFactory.create(is_superuser=True, is_staff=True)


@pytest.fixture
def admin(actor):
    client = APIClient()
    client.force_authenticate(actor)
    return client


def _role(admin, code="temporary", name="Temporary"):
    assert admin.post(ROLES, {"name": name, "code": code}, format="json").status_code == 201
    return Role.objects.get(code=code)


def _group(admin, code="temp-group", name="Temp group"):
    assert admin.post(GROUPS, {"name": name, "code": code}, format="json").status_code == 201
    return Group.objects.get(code=code)


def _codes(admin, url):
    return {row["code"] for row in admin.get(f"{url}?page_size=200").json()["results"]}


class TestADeletedRole:
    def test_it_leaves_the_list_and_every_route(self, admin):
        role = _role(admin)
        holder = UserFactory.create()
        UserRole.objects.create(user=holder, role=role)
        url = f"{ROLES}{role.pk}/"

        assert admin.delete(url).status_code == 204

        assert "temporary" not in _codes(admin, ROLES)
        assert admin.get(f"{ROLES}?search=Temporary").json()["count"] == 0
        assert admin.get(url).status_code == 404
        assert admin.patch(url, {"name": "Back"}, format="json").status_code == 404
        assert admin.delete(url).status_code == 404
        for nested in ("permissions", "users", "groups"):
            assert admin.get(f"{url}{nested}/").status_code == 404, nested

    def test_its_code_and_name_can_be_used_again(self, admin, actor):
        role = _role(admin)
        assert admin.delete(f"{ROLES}{role.pk}/").status_code == 204

        role.refresh_from_db()
        assert role.is_deleted is True
        assert role.code == f"temporary--deleted-{role.pk.hex[:8]}"
        again = admin.post(ROLES, {"name": "Temporary", "code": "temporary"}, format="json")
        assert again.status_code == 201, again.content
        assert "temporary" in _codes(admin, ROLES)
        event = SecurityEvent.objects.get(metadata__action="delete_role")
        assert event.user == actor
        assert event.metadata == {
            "action": "delete_role",
            "role_id": str(role.pk),
            "code": "temporary",
        }

    def test_a_long_code_still_fits(self, admin):
        code = "r" * 100
        role = _role(admin, code=code, name="Long")
        assert admin.delete(f"{ROLES}{role.pk}/").status_code == 204
        role.refresh_from_db()
        assert len(role.code) == 100
        assert role.code.endswith(f"--deleted-{role.pk.hex[:8]}")
        assert admin.post(ROLES, {"name": "Long", "code": code}, format="json").status_code == 201

    def test_a_system_role_is_still_refused(self, admin):
        system = Role.objects.get(code="artist")
        assert admin.delete(f"{ROLES}{system.pk}/").status_code == 400
        system.refresh_from_db()
        assert system.code == "artist" and system.is_deleted is False

    def test_it_grants_nothing_and_cannot_be_attached(self, admin):
        role = _role(admin)
        permission = Permission.objects.get(code="shot.view")
        assert (
            admin.post(
                f"{ROLES}{role.pk}/permissions/",
                {"permission_id": str(permission.pk)},
                format="json",
            ).status_code
            == 201
        )
        holder = UserFactory.create()
        UserRole.objects.create(user=holder, role=role)
        group = _group(admin)
        GroupRole.objects.create(group=group, role=role)
        assert "shot.view" in PermissionCacheService.get_permissions(user=holder)

        assert admin.delete(f"{ROLES}{role.pk}/").status_code == 204
        cache.clear()

        assert "shot.view" not in PermissionCacheService.get_permissions(user=holder)
        assert admin.get(f"{GROUPS}{group.pk}/roles/").json() == []
        attach = admin.post(f"{GROUPS}{group.pk}/roles/", {"role_id": str(role.pk)}, format="json")
        assert attach.status_code == 400


class TestADeletedGroup:
    def test_it_leaves_the_list_and_its_code_can_be_used_again(self, admin, actor):
        group = _group(admin)
        url = f"{GROUPS}{group.pk}/"

        assert admin.delete(url).status_code == 204

        assert "temp-group" not in _codes(admin, GROUPS)
        assert admin.get(url).status_code == 404
        assert admin.delete(url).status_code == 404
        assert admin.get(f"{url}members/").status_code == 404
        group.refresh_from_db()
        assert group.code == f"temp-group--deleted-{group.pk.hex[:8]}"
        assert (
            admin.post(
                GROUPS, {"name": "Temp group", "code": "temp-group"}, format="json"
            ).status_code
            == 201
        )
        event = SecurityEvent.objects.get(metadata__action="delete_group")
        assert event.user == actor
        assert event.metadata["code"] == "temp-group"

    def test_it_cannot_be_attached_to_a_role(self, admin):
        group = _group(admin)
        role = _role(admin)
        assert admin.delete(f"{GROUPS}{group.pk}/").status_code == 204
        attach = admin.post(f"{ROLES}{role.pk}/groups/", {"group_id": str(group.pk)}, format="json")
        assert attach.status_code == 400


class TestTheMigration:
    def test_it_frees_the_codes_of_rows_deleted_before(self, admin):
        role = _role(admin)
        group = _group(admin)
        live = _role(admin, code="live-role", name="Live")
        Role.objects.filter(pk=role.pk).update(is_deleted=True)  # deleted the old way: code kept
        Group.objects.filter(pk=group.pk).update(is_deleted=True)
        released = Role.objects.create(
            name="Done", code=f"done--deleted-{'a' * 8}", is_deleted=True
        )

        migration = importlib.import_module(
            "apps.identity.migrations.0005_release_deleted_rbac_codes"
        )
        migration.release(django_apps, None)
        migration.release(django_apps, None)  # running it again changes nothing

        role.refresh_from_db()
        group.refresh_from_db()
        live.refresh_from_db()
        released.refresh_from_db()
        assert role.code == f"temporary--deleted-{role.pk.hex[:8]}"
        assert group.code == f"temp-group--deleted-{group.pk.hex[:8]}"
        assert live.code == "live-role"
        assert released.code == f"done--deleted-{'a' * 8}"
        assert (
            admin.post(ROLES, {"name": "Temporary", "code": "temporary"}, format="json").status_code
            == 201
        )
