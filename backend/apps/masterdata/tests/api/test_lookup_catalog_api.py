"""HTTP contract of the six managed lookup catalogs (CONTRACTS §3, API-MD-*)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import (
    MasterdataPermissions,
    PlatformMasterDataPermissions,
)
from apps.masterdata.tests.factories import (
    MasterAssetTypeFactory,
    MasterFileTypeFactory,
    MasterReviewTypeFactory,
    MasterShotTypeFactory,
    MasterStatusFactory,
    MasterTaskTypeFactory,
)

pytestmark = pytest.mark.django_db

BASE = "/api/v1/platform/master-data"

# slug -> (factory, valid create payload, label used in the DELETE message)
TYPES = {
    "statuses": (
        MasterStatusFactory,
        {"entity_type": "Task", "code": "blocked", "name": "Blocked"},
        "Status",
    ),
    "task-types": (MasterTaskTypeFactory, {"code": "anim", "name": "Animation"}, "Task type"),
    "asset-types": (MasterAssetTypeFactory, {"code": "prop", "name": "Prop"}, "Asset type"),
    "shot-types": (MasterShotTypeFactory, {"code": "cu", "name": "Close up"}, "Shot type"),
    "review-types": (
        MasterReviewTypeFactory,
        {"code": "dailies", "name": "Dailies"},
        "Review type",
    ),
    "file-types": (MasterFileTypeFactory, {"name": "OpenEXR", "extension": "exr"}, "File type"),
}
slugs = pytest.mark.parametrize("slug", list(TYPES))


def client_for(*codes: str) -> APIClient:
    user = UserFactory.create()
    if codes:
        grant_permissions(user, *codes)
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon():
    return APIClient(raise_request_exception=False)


@pytest.fixture
def reader():
    return client_for()


@pytest.fixture
def manager():
    return client_for(MasterdataPermissions.CATALOG_MANAGE)


@pytest.fixture
def hard_manager():
    return client_for(MasterdataPermissions.CATALOG_MANAGE, MasterdataPermissions.HARD_DELETE)


def error_code(response) -> str:
    return response.json()["error"]["code"]


@slugs
class TestAuthorizationMatrix:
    def test_anonymous_is_refused_everywhere(self, anon, slug):
        row = TYPES[slug][0]()
        assert anon.get(f"{BASE}/{slug}").status_code == 401
        assert anon.get(f"{BASE}/{slug}/{row.pk}").status_code == 401
        assert anon.post(f"{BASE}/{slug}", TYPES[slug][1], format="json").status_code == 401
        assert anon.delete(f"{BASE}/{slug}/{row.pk}").status_code == 401

    def test_authenticated_user_can_read_but_not_write(self, reader, slug):
        factory, payload, _ = TYPES[slug]
        row = factory()
        listed = reader.get(f"{BASE}/{slug}")
        assert listed.status_code == 200 and isinstance(listed.json(), list)
        assert reader.get(f"{BASE}/{slug}/{row.pk}").status_code == 200
        assert reader.post(f"{BASE}/{slug}", payload, format="json").status_code == 403
        assert (
            reader.patch(f"{BASE}/{slug}/{row.pk}", {"name": "x"}, format="json").status_code == 403
        )
        assert reader.post(f"{BASE}/{slug}/{row.pk}/archive").status_code == 403
        assert reader.post(f"{BASE}/{slug}/{row.pk}/restore").status_code == 403
        assert reader.delete(f"{BASE}/{slug}/{row.pk}").status_code == 403
        assert (
            reader.post(f"{BASE}/{slug}/reorder", {"ids": [str(row.pk)]}, format="json").status_code
            == 403
        )

    def test_manager_can_write(self, manager, slug):
        _, payload, _ = TYPES[slug]
        created = manager.post(f"{BASE}/{slug}", payload, format="json")
        assert created.status_code == 201, created.content
        assert created.json()["is_system"] is False and created.json()["status"] == "active"

    def test_the_legacy_configure_grant_still_works(self, slug):
        legacy = client_for(PlatformMasterDataPermissions.CONFIGURE)
        response = legacy.post(f"{BASE}/{slug}", TYPES[slug][1], format="json")
        assert response.status_code == 201, response.content

    def test_hard_delete_needs_its_own_grant(self, manager, slug):
        factory = TYPES[slug][0]
        row = factory()
        manager.delete(f"{BASE}/{slug}/{row.pk}")  # soft delete
        assert manager.delete(f"{BASE}/{slug}/{row.pk}?hard=true").status_code == 403
        assert factory._meta.model.all_objects.filter(pk=row.pk).exists()


@slugs
class TestReadContract:
    def test_list_is_a_bare_array_ordered_and_hides_deleted_rows(self, reader, slug):
        factory = TYPES[slug][0]
        keep, gone = factory(), factory()
        gone.delete()
        body = reader.get(f"{BASE}/{slug}").json()
        assert [r["id"] for r in body] == [str(keep.pk)]

    def test_malformed_or_unknown_id_is_404(self, reader, slug):
        assert reader.get(f"{BASE}/{slug}/not-a-uuid").status_code == 404
        assert reader.get(f"{BASE}/{slug}/00000000-0000-0000-0000-000000000000").status_code == 404

    def test_response_exposes_system_flag_and_status_but_no_organization(self, reader, slug):
        row = TYPES[slug][0]()
        body = reader.get(f"{BASE}/{slug}/{row.pk}").json()
        assert {"is_system", "status", "scope"} <= set(body)
        assert body["scope"] == "GLOBAL" and "organization" not in body


@slugs
class TestWriteContract:
    def test_duplicate_code_is_a_400_with_a_field_error(self, manager, slug):
        _, payload, _ = TYPES[slug]
        if slug == "file-types":
            payload = {**payload, "code": "exr"}
        assert manager.post(f"{BASE}/{slug}", payload, format="json").status_code == 201
        again = manager.post(
            f"{BASE}/{slug}", {**payload, "name": "Other name", "extension": "zzz"}, format="json"
        )
        assert again.status_code == 400, again.content
        assert "code" in again.json()

    def test_organization_scope_is_refused(self, manager, slug):
        response = manager.post(
            f"{BASE}/{slug}", {**TYPES[slug][1], "scope": "ORGANIZATION"}, format="json"
        )
        assert response.status_code == 400
        assert "scope" in response.json()

    def test_status_and_system_flag_are_read_only(self, manager, slug):
        factory = TYPES[slug][0]
        row = factory()
        response = manager.patch(
            f"{BASE}/{slug}/{row.pk}",
            {"status": "archived", "is_system": True, "name": "Renamed"},
            format="json",
        )
        assert response.status_code == 200
        row.refresh_from_db()
        assert (row.name, row.status, row.is_system) == ("Renamed", "active", False)

    def test_put_and_patch_update(self, manager, slug):
        row = TYPES[slug][0]()
        assert (
            manager.patch(
                f"{BASE}/{slug}/{row.pk}", {"description": "d"}, format="json"
            ).status_code
            == 200
        )
        full = manager.get(f"{BASE}/{slug}/{row.pk}").json()
        full["description"] = "e"
        assert manager.put(f"{BASE}/{slug}/{row.pk}", full, format="json").status_code == 200

    def test_archive_and_restore_keep_the_success_envelope(self, manager, slug):
        row = TYPES[slug][0]()
        archived = manager.post(f"{BASE}/{slug}/{row.pk}/archive")
        assert archived.status_code == 200
        assert (
            archived.json()["success"] is True and archived.json()["data"]["status"] == "archived"
        )
        restored = manager.post(f"{BASE}/{slug}/{row.pk}/restore")
        assert restored.json()["data"]["status"] == "active"

    def test_delete_is_a_soft_delete_with_the_message_envelope(self, manager, slug):
        factory, _, label = TYPES[slug]
        row = factory()
        response = manager.delete(f"{BASE}/{slug}/{row.pk}")
        assert response.status_code == 200
        assert response.json() == {"success": True, "message": f"{label} deleted."}
        assert manager.get(f"{BASE}/{slug}/{row.pk}").status_code == 404
        assert factory._meta.model.all_objects.get(pk=row.pk).is_deleted is True

    def test_a_soft_deleted_row_can_be_restored_through_the_api(self, manager, slug):
        factory = TYPES[slug][0]
        row = factory()
        manager.delete(f"{BASE}/{slug}/{row.pk}")
        restored = manager.post(f"{BASE}/{slug}/{row.pk}/restore")
        assert restored.status_code == 200
        assert manager.get(f"{BASE}/{slug}/{row.pk}").status_code == 200

    def test_hard_delete_flow(self, hard_manager, slug):
        factory = TYPES[slug][0]
        row = factory()
        live = hard_manager.delete(f"{BASE}/{slug}/{row.pk}?hard=true")
        assert live.status_code == 409 and error_code(live) == "not_soft_deleted"
        hard_manager.delete(f"{BASE}/{slug}/{row.pk}")
        done = hard_manager.delete(f"{BASE}/{slug}/{row.pk}?hard=true")
        assert done.status_code == 204
        assert not factory._meta.model.all_objects.filter(pk=row.pk).exists()

    def test_hard_flag_must_be_a_boolean(self, hard_manager, slug):
        row = TYPES[slug][0]()
        assert hard_manager.delete(f"{BASE}/{slug}/{row.pk}?hard=banana").status_code == 400
        assert TYPES[slug][0]._meta.model.objects.filter(pk=row.pk).exists()

    def test_system_rows_are_protected(self, manager, slug):
        factory = TYPES[slug][0]
        row = factory(is_system=True)
        for call in (
            lambda: manager.post(f"{BASE}/{slug}/{row.pk}/archive"),
            lambda: manager.delete(f"{BASE}/{slug}/{row.pk}"),
            lambda: manager.patch(f"{BASE}/{slug}/{row.pk}", {"code": "changed"}, format="json"),
        ):
            response = call()
            assert response.status_code == 409 and error_code(response) == "system_row_protected"
        assert (
            manager.patch(
                f"{BASE}/{slug}/{row.pk}", {"name": "New name"}, format="json"
            ).status_code
            == 200
        )

    def test_reorder(self, manager, slug):
        factory = TYPES[slug][0]
        a, b, c = factory(), factory(), factory()
        response = manager.post(
            f"{BASE}/{slug}/reorder", {"ids": [str(c.pk), str(a.pk), str(b.pk)]}, format="json"
        )
        assert response.status_code == 200
        assert [r["id"] for r in response.json()] == [str(c.pk), str(a.pk), str(b.pk)]
        listed = manager.get(f"{BASE}/{slug}").json()
        assert [r["id"] for r in listed] == [str(c.pk), str(a.pk), str(b.pk)]

    def test_reorder_validates_the_body(self, manager, slug):
        assert manager.post(f"{BASE}/{slug}/reorder", {"ids": []}, format="json").status_code == 400
        assert (
            manager.post(f"{BASE}/{slug}/reorder", {"ids": ["nope"]}, format="json").status_code
            == 400
        )
        unknown = manager.post(
            f"{BASE}/{slug}/reorder",
            {"ids": ["00000000-0000-0000-0000-000000000000"]},
            format="json",
        )
        assert unknown.status_code == 400


class TestTypeSpecificContract:
    def test_two_file_types_can_be_created_without_a_code(self, manager):
        """AUDIT P13: the second code-less create used to return 409."""
        for ext, name in (("exr", "OpenEXR"), ("dpx", "DPX")):
            response = manager.post(
                f"{BASE}/file-types", {"name": name, "extension": ext}, format="json"
            )
            assert response.status_code == 201, response.content
            assert response.json()["code"] == ext

    def test_the_same_status_code_is_allowed_for_two_entity_types(self, manager):
        for entity in ("Task", "Shot"):
            payload = {"entity_type": entity, "code": "in_progress", "name": "In progress"}
            assert manager.post(f"{BASE}/statuses", payload, format="json").status_code == 201

    def test_status_entity_type_and_category_are_validated(self, manager):
        bad = manager.post(
            f"{BASE}/statuses", {"entity_type": "Nope", "code": "x", "name": "X"}, format="json"
        )
        assert bad.status_code == 400 and "entity_type" in bad.json()
        bad = manager.post(
            f"{BASE}/statuses",
            {"entity_type": "Task", "code": "x", "name": "X", "category": "nope"},
            format="json",
        )
        assert bad.status_code == 400

    def test_setting_a_new_default_status_replaces_the_old(self, manager):
        first = manager.post(
            f"{BASE}/statuses",
            {"entity_type": "Task", "code": "a", "name": "A", "is_default": True},
            format="json",
        ).json()
        manager.post(
            f"{BASE}/statuses",
            {"entity_type": "Task", "code": "b", "name": "B", "is_default": True},
            format="json",
        )
        assert manager.get(f"{BASE}/statuses/{first['id']}").json()["is_default"] is False

    def test_statuses_are_filterable_by_entity_type_and_ordered_by_order(self, manager):
        MasterStatusFactory(entity_type="Task", order=2, name="B")
        MasterStatusFactory(entity_type="Task", order=1, name="A")
        MasterStatusFactory(entity_type="Shot", order=0, name="S")
        rows = manager.get(f"{BASE}/statuses?entity_type=Task").json()
        assert [r["name"] for r in rows] == ["A", "B"]

    def test_search_by_name(self, manager):
        MasterTaskTypeFactory(name="Animation")
        MasterTaskTypeFactory(name="Lighting")
        assert [r["name"] for r in manager.get(f"{BASE}/task-types?search=anim").json()] == [
            "Animation"
        ]


class TestRealAuthentication:
    """One flow through the real auth chain: login, then call with the issued JWT."""

    def test_login_then_read_and_write_with_the_access_token(self):
        user = UserFactory.create(is_email_verified=True)
        user.set_password("S3cure-passw0rd!")
        user.save(update_fields=["password"])
        grant_permissions(user, MasterdataPermissions.CATALOG_MANAGE)

        client = APIClient(raise_request_exception=False)
        login = client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "S3cure-passw0rd!"},
            format="json",
        )
        assert login.status_code == 200, login.content
        token = login.json()["tokens"]["access"]

        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        assert client.get(f"{BASE}/task-types").status_code == 200
        created = client.post(
            f"{BASE}/task-types", {"code": "anim", "name": "Animation"}, format="json"
        )
        assert created.status_code == 201, created.content

        client.credentials()
        assert (
            client.post(f"{BASE}/task-types", {"code": "x", "name": "X"}, format="json").status_code
            == 401
        )
