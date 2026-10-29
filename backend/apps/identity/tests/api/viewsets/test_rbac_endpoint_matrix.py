"""Actor matrix for the RBAC write endpoints: anonymous / user / role admin / superuser."""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.models import Group, Permission, Role
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import ensure_permission, grant_permissions


def _client(user=None):
    client = APIClient()
    if user is not None:
        client.force_authenticate(user=user)
    return client


def _actor(kind, *codes):
    if kind == "anonymous":
        return None
    if kind == "user":
        return UserFactory.create()
    if kind == "superuser":
        return UserFactory.create(is_superuser=True, is_staff=True)
    user = UserFactory.create()
    grant_permissions(user, *codes)
    return user


MATRIX = [
    ("anonymous", 401),
    ("user", 403),
    ("role_admin", 201),
    ("superuser", 201),
]

# (module, action) is unique and ``module`` is a closed choice set.
PERMISSION_MODULE = {"role_admin": "office", "superuser": "team"}


@pytest.mark.django_db
class TestRbacWriteMatrix:
    @pytest.mark.parametrize(("kind", "expected"), MATRIX)
    def test_create_role(self, kind, expected):
        actor = _actor(kind, "identity.role.create")

        response = _client(actor).post(
            reverse("api:v1:identity-rbac:role-list"),
            {"name": f"Matrix {kind}", "code": f"matrix-{kind}"},
            format="json",
        )

        assert response.status_code == expected
        assert Role.objects.filter(code=f"matrix-{kind}").exists() is (expected == 201)

    @pytest.mark.parametrize(("kind", "expected"), MATRIX)
    def test_create_group(self, kind, expected):
        actor = _actor(kind, "identity.group.create")

        response = _client(actor).post(
            reverse("api:v1:identity-rbac:group-list"),
            {"name": f"Matrix G {kind}", "code": f"matrix-g-{kind}"},
            format="json",
        )

        assert response.status_code == expected

    @pytest.mark.parametrize(("kind", "expected"), MATRIX)
    def test_create_permission(self, kind, expected):
        actor = _actor(kind, "identity.permission.create")

        response = _client(actor).post(
            reverse("api:v1:identity-rbac:permission-list"),
            {
                "name": "Matrix",
                "code": f"matrix.{kind}.view",
                "module": PERMISSION_MODULE.get(kind, "office"),
                "action": "view",
                "category": "general",
            },
            format="json",
        )

        assert response.status_code == expected

    @pytest.mark.parametrize(
        ("kind", "allowed", "denied_status"),
        [
            ("anonymous", False, 401),
            ("user", False, 403),
            ("role_admin", True, None),
            ("superuser", True, None),
        ],
    )
    def test_delete_role(self, kind, allowed, denied_status):
        actor = _actor(kind, "identity.role.delete")
        role = Role.objects.create(name=f"Doomed {kind}", code=f"doomed-{kind}")

        response = _client(actor).delete(
            reverse("api:v1:identity-rbac:role-detail", kwargs={"pk": role.pk}),
        )

        if allowed:
            assert response.status_code in (200, 204)
            assert not Role.objects.filter(pk=role.pk, is_deleted=False).exists()
        else:
            assert response.status_code == denied_status
            assert Role.objects.filter(pk=role.pk, is_deleted=False).exists()


@pytest.mark.django_db
class TestRbacApiRules:
    def test_duplicate_role_name_is_a_client_error_not_a_500(self):
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        client = _client(admin)
        url = reverse("api:v1:identity-rbac:role-list")
        client.post(url, {"name": "Dupes", "code": "dupes-a"}, format="json")

        response = client.post(url, {"name": "dupes", "code": "dupes-b"}, format="json")

        assert 400 <= response.status_code < 500
        assert Role.objects.filter(name__iexact="dupes").count() == 1

    def test_duplicate_group_name_is_a_client_error_not_a_500(self):
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        client = _client(admin)
        url = reverse("api:v1:identity-rbac:group-list")
        client.post(url, {"name": "Crew", "code": "crew-a"}, format="json")

        response = client.post(url, {"name": "CREW", "code": "crew-b"}, format="json")

        assert 400 <= response.status_code < 500
        assert Group.objects.filter(name__iexact="crew").count() == 1

    def test_api_cannot_create_system_permission(self):
        admin = UserFactory.create(is_superuser=True, is_staff=True)

        response = _client(admin).post(
            reverse("api:v1:identity-rbac:permission-list"),
            {
                "name": "Sneaky",
                "code": "sneaky.perm.view",
                "module": "department",
                "action": "view",
                "category": "general",
                "is_system": True,
            },
            format="json",
        )

        assert response.status_code == 201
        assert Permission.objects.get(code="sneaky.perm.view").is_system is False

    def test_system_permission_delete_rejected_via_api(self):
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        permission = ensure_permission("sys.perm.delete")
        permission.is_system = True
        permission.save(update_fields=["is_system"])

        response = _client(admin).delete(
            reverse("api:v1:identity-rbac:permission-detail", kwargs={"pk": permission.pk}),
        )

        assert 400 <= response.status_code < 500
        assert Permission.objects.filter(pk=permission.pk, is_deleted=False).exists()
