"""The file registry API (API-PUB-09 to API-PUB-11): scoping, status codes, bulk contract."""

from __future__ import annotations

import pytest

from apps.production.tests.factories import ProjectFactory
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import PublishedFile
from apps.publishing.tests.helpers import (
    OTHER_SHA,
    client_for,
    member,
    outsider,
    published_version,
    registration,
    storage_root,
    unpublished_version,
)

pytestmark = pytest.mark.django_db

FILES = "/api/v1/publishing/files/"


@pytest.fixture
def version(project):
    return published_version(project)


@pytest.fixture
def operator(project):
    return member(project, P.VIEW, P.CREATE, P.DEPRECATE, P.REVOKE)


@pytest.fixture
def api(operator):
    return client_for(operator)


def _post(api, version, root, path="s/plate.exr", **over):
    return api.post(FILES, registration(version, root, path, **over), format="json")


class TestRegister:
    def test_201_then_200_for_an_identical_retry(self, api, version, root):
        first = _post(api, version, root)
        again = _post(api, version, root)

        assert first.status_code == 201
        assert again.status_code == 200
        assert first.json()["id"] == again.json()["id"]
        body = first.json()
        assert body["status"] == "Registered"
        assert body["storage_root"] == "PROJECTS"
        assert body["sha256"] == "a" * 64
        assert body["project_id"] == str(version.project_id)

    def test_a_conflicting_registration_is_409(self, api, version, root):
        _post(api, version, root)

        response = _post(api, version, root, sha256=OTHER_SHA)

        assert response.status_code == 409
        assert "path_already_registered" in response.content.decode()

    def test_unknown_keys_are_400(self, api, version, root):
        response = _post(api, version, root, status="Revoked", surprise=1)

        assert response.status_code == 400
        assert PublishedFile.objects.count() == 0

    @pytest.mark.parametrize("path", ["../x.exr", "/etc/passwd", "a\\b", "a//b"])
    def test_traversal_paths_are_400(self, api, version, root, path):
        assert _post(api, version, root, path).status_code == 400

    def test_an_unpublished_version_is_400(self, api, root, project):
        draft = unpublished_version(project)

        assert _post(api, draft, root).status_code == 400

    def test_a_version_of_a_project_you_are_not_in_is_the_same_400(self, api, root):
        foreign = published_version(ProjectFactory.create(code="FOREIGNP"))
        unknown = api.post(
            FILES,
            registration(foreign, root) | {"version_id": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )
        forbidden = _post(api, foreign, root)

        def without_request_id(response):
            body = response.json()
            body["error"].pop("request_id")
            return body

        assert forbidden.status_code == unknown.status_code == 400
        assert without_request_id(forbidden) == without_request_id(unknown)

    def test_the_create_code_is_needed(self, version, root, project):
        viewer = member(project, P.VIEW)

        assert _post(client_for(viewer), version, root).status_code == 403

    def test_anonymous_is_401(self, version, root):
        from rest_framework.test import APIClient

        assert _post(APIClient(), version, root).status_code in (401, 403)

    @pytest.mark.parametrize("method", ["put", "patch", "delete"])
    def test_a_registered_file_cannot_be_edited_or_deleted_through_the_api(
        self, api, version, root, method
    ):
        file_id = _post(api, version, root).json()["id"]

        response = getattr(api, method)(f"{FILES}{file_id}/", {"sha256": OTHER_SHA}, format="json")

        assert response.status_code == 405
        assert PublishedFile.objects.get(pk=file_id).sha256 == "a" * 64


class TestReading:
    def test_members_see_their_projects_files_and_nobody_elses(self, api, version, root):
        mine = _post(api, version, root).json()["id"]
        other_project = ProjectFactory.create(code="OTHERPP")
        other_user = member(other_project, P.VIEW, P.CREATE)
        theirs = (
            client_for(other_user)
            .post(
                FILES,
                registration(published_version(other_project), root, "s/other.exr"),
                format="json",
            )
            .json()["id"]
        )

        listed = {row["id"] for row in api.get(FILES).json()["results"]}

        assert listed == {mine}
        assert api.get(f"{FILES}{mine}/").status_code == 200
        assert api.get(f"{FILES}{theirs}/").status_code == 404

    def test_a_non_member_sees_nothing_and_gets_404s(self, api, version, root):
        file_id = _post(api, version, root).json()["id"]
        stranger = client_for(outsider(P.VIEW, P.DEPRECATE, P.REVOKE))

        assert stranger.get(FILES).json()["results"] == []
        assert stranger.get(f"{FILES}{file_id}/").status_code == 404
        for action in ("deprecate", "restore"):
            assert (
                stranger.post(f"{FILES}{file_id}/{action}/", {}, format="json").status_code == 404
            )
        assert (
            stranger.post(f"{FILES}{file_id}/revoke/", {"reason": "x"}, format="json").status_code
            == 404
        )
        assert PublishedFile.objects.get(pk=file_id).status == "Registered"

    def test_a_platform_admin_sees_every_project(self, api, version, root):
        _post(api, version, root)
        admin = outsider(P.VIEW)
        admin.is_superuser = True
        admin.save()

        assert len(client_for(admin).get(FILES).json()["results"]) == 1

    def test_filters(self, api, version, root, project):
        other_version = published_version(project)
        _post(api, version, root, "s/a.exr")
        _post(api, version, root, "s/b.exr", role="proxy")
        _post(api, other_version, storage_root("ARCHIVE"), "s/c.exr")

        def count(**params):
            return len(api.get(FILES, params).json()["results"])

        assert count() == 3
        assert count(version_id=str(version.pk)) == 2
        assert count(role="proxy") == 1
        assert count(storage_root="archive") == 1
        assert count(status="Revoked") == 0
        assert count(project_id=str(project.pk)) == 3
        assert count(version_id="not-a-uuid") == 0

    def test_viewing_needs_the_view_code(self, version, root, project):
        creator_only = member(project, P.CREATE)

        assert client_for(creator_only).get(FILES).status_code == 403


class TestRevokeReasonVisibility:
    def _revoked(self, api, version, root):
        file_id = _post(api, version, root).json()["id"]
        api.post(f"{FILES}{file_id}/revoke/", {"reason": "light leak in frame 12"}, format="json")
        return file_id

    def test_the_revoker_and_the_registrant_see_it(self, api, version, root):
        file_id = self._revoked(api, version, root)

        assert api.get(f"{FILES}{file_id}/").json()["revoke_reason"] == "light leak in frame 12"

    def test_a_plain_viewer_does_not(self, api, version, root, project):
        file_id = self._revoked(api, version, root)
        viewer = client_for(member(project, P.VIEW))

        body = viewer.get(f"{FILES}{file_id}/").json()

        assert body["status"] == "Revoked"
        assert body["revoke_reason"] == ""
        assert "light leak" not in viewer.get(FILES).content.decode()

    def test_another_revoker_does(self, api, version, root, project):
        file_id = self._revoked(api, version, root)
        other_revoker = client_for(member(project, P.VIEW, P.REVOKE))

        assert other_revoker.get(f"{FILES}{file_id}/").json()["revoke_reason"] != ""


class TestLifecycle:
    def test_deprecate_restore_revoke(self, api, version, root):
        file_id = _post(api, version, root).json()["id"]

        assert (
            api.post(f"{FILES}{file_id}/deprecate/", {"note": "old"}, format="json").json()[
                "status"
            ]
            == "Deprecated"
        )
        assert (
            api.post(f"{FILES}{file_id}/restore/", {}, format="json").json()["status"]
            == "Registered"
        )
        revoked = api.post(f"{FILES}{file_id}/revoke/", {"reason": "bad"}, format="json")
        assert revoked.status_code == 200 and revoked.json()["status"] == "Revoked"

    def test_revoke_needs_a_reason(self, api, version, root):
        file_id = _post(api, version, root).json()["id"]

        assert api.post(f"{FILES}{file_id}/revoke/", {}, format="json").status_code == 400
        assert (
            api.post(f"{FILES}{file_id}/revoke/", {"reason": ""}, format="json").status_code == 400
        )

    def test_a_move_the_map_forbids_is_409(self, api, version, root):
        file_id = _post(api, version, root).json()["id"]
        api.post(f"{FILES}{file_id}/revoke/", {"reason": "bad"}, format="json")

        response = api.post(f"{FILES}{file_id}/revoke/", {"reason": "again"}, format="json")

        assert response.status_code == 409
        assert "invalid_transition" in response.content.decode()

    def test_deprecating_a_deprecated_file_is_409(self, api, version, root):
        file_id = _post(api, version, root).json()["id"]
        api.post(f"{FILES}{file_id}/deprecate/", {}, format="json")

        assert api.post(f"{FILES}{file_id}/deprecate/", {}, format="json").status_code == 409

    def test_a_revoked_file_cannot_be_deprecated_without_the_override(
        self, api, version, root, project
    ):
        file_id = _post(api, version, root).json()["id"]
        api.post(f"{FILES}{file_id}/revoke/", {"reason": "bad"}, format="json")
        holder = client_for(member(project, P.VIEW, P.DEPRECATE, P.STATUS_OVERRIDE))

        assert api.post(f"{FILES}{file_id}/deprecate/", {}, format="json").status_code == 400
        assert (
            holder.post(
                f"{FILES}{file_id}/deprecate/",
                {"override_reason": "keep for reference"},
                format="json",
            ).json()["status"]
            == "Deprecated"
        )

    def test_leaving_revoked_needs_override_code_and_reason(self, api, version, root, project):
        file_id = _post(api, version, root).json()["id"]
        api.post(f"{FILES}{file_id}/revoke/", {"reason": "bad"}, format="json")

        no_reason = api.post(f"{FILES}{file_id}/restore/", {}, format="json")
        no_code = api.post(
            f"{FILES}{file_id}/restore/", {"override_reason": "mistake"}, format="json"
        )
        holder = client_for(member(project, P.VIEW, P.DEPRECATE, P.STATUS_OVERRIDE))
        allowed = holder.post(
            f"{FILES}{file_id}/restore/", {"override_reason": "mistake"}, format="json"
        )

        assert (no_reason.status_code, no_code.status_code, allowed.status_code) == (400, 403, 200)

    @pytest.mark.parametrize(
        ("action", "missing"),
        [("deprecate", P.DEPRECATE), ("restore", P.DEPRECATE), ("revoke", P.REVOKE)],
    )
    def test_each_action_needs_its_own_code(self, api, version, root, project, action, missing):
        file_id = _post(api, version, root).json()["id"]
        codes = {P.VIEW, P.DEPRECATE, P.REVOKE} - {missing}
        client = client_for(member(project, *codes))

        response = client.post(f"{FILES}{file_id}/{action}/", {"reason": "x"}, format="json")

        assert response.status_code == 403
        assert PublishedFile.objects.get(pk=file_id).status == "Registered"


class TestBulk:
    URL = f"{FILES}bulk-register/"

    def test_all_ok_is_200(self, api, version, root):
        items = [registration(version, root, f"s/f{i}.exr") for i in range(3)]

        response = api.post(self.URL, {"items": items}, format="json")

        assert response.status_code == 200
        body = response.json()
        assert (body["success"], body["succeeded_count"], body["failed_count"]) == (True, 3, 0)
        assert [r["ok"] for r in body["results"]] == [True] * 3

    def test_one_failure_makes_it_207_with_per_item_results(self, api, version, root):
        items = [
            registration(version, root, "s/a.exr"),
            registration(version, root, "../bad.exr"),
            registration(version, root, "s/c.exr"),
        ]

        response = api.post(self.URL, {"items": items}, format="json")

        assert response.status_code == 207
        body = response.json()
        assert (body["succeeded_count"], body["failed_count"]) == (2, 1)
        assert body["results"][1]["error"] == "invalid"
        assert "relative_path" in body["results"][1]["fields"]
        assert PublishedFile.objects.count() == 2

    def test_empty_and_oversized_batches_are_400(self, api, version, root):
        assert api.post(self.URL, {"items": []}, format="json").status_code == 400
        too_many = [registration(version, root, f"s/{i}.exr") for i in range(101)]
        assert api.post(self.URL, {"items": too_many}, format="json").status_code == 400
        assert PublishedFile.objects.count() == 0

    def test_it_needs_the_create_code(self, version, root, project):
        viewer = client_for(member(project, P.VIEW))

        assert (
            viewer.post(
                self.URL, {"items": [registration(version, root)]}, format="json"
            ).status_code
            == 403
        )
