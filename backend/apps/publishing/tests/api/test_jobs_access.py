"""
Who may touch which export job (SEC-PUB-01, API-PUB-02): jobs are narrowed to the caller's
projects; anything else is a 404 exactly like an unknown id.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.models import ApiKey
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, ShotFactory
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import PublishItem
from apps.publishing.services.jobs import create_job
from apps.publishing.tests.helpers import client_for, member, outsider, published_version

pytestmark = pytest.mark.django_db

URL = "/api/v1/publishing/"
BODY = {
    "name": "Rig export",
    "entity_type": "Shot",
    "entity_id": "x",
    "entity_code": "SH010",
    "entity_name": "Opening",
    "dcc_tool": "Maya",
    "source_file": "work/a.ma",
}
ALL = (P.VIEW, P.CREATE, P.UPDATE, P.DELETE)


@pytest.fixture
def mine(project):
    return create_job(actor=None, data={**BODY, "project_id": str(project.pk), "name": "Mine"})


@pytest.fixture
def theirs():
    other = ProjectFactory.create(code="THEIRS")
    return create_job(actor=None, data={**BODY, "project_id": str(other.pk), "name": "Theirs"})


@pytest.fixture
def legacy():
    """An old job that names no project."""
    return PublishItem.objects.create(
        name="Legacy", code="LEGACY-1", entity_type="Shot", entity_id="1", entity_code="S",
        entity_name="S", dcc_tool="Maya", source_file="a",
    )  # fmt: skip


@pytest.fixture
def user(project):
    return member(project, *ALL)


@pytest.fixture
def api(user):
    return client_for(user)


def _ids(response):
    return {row["id"] for row in response.json()["results"]}


class TestReading:
    def test_a_member_sees_their_projects_jobs_only(self, api, mine, theirs, legacy):
        assert _ids(api.get(URL)) == {str(mine.pk)}

    def test_a_platform_admin_sees_every_job_including_legacy_ones(self, mine, theirs, legacy):
        admin = outsider(P.VIEW)
        admin.is_superuser = True
        admin.save()

        assert _ids(client_for(admin).get(URL)) == {str(mine.pk), str(theirs.pk), str(legacy.pk)}

    def test_a_non_member_sees_nothing(self, mine):
        stranger = client_for(outsider(*ALL))

        assert stranger.get(URL).json()["results"] == []

    def test_other_projects_ids_are_404_exactly_like_unknown_ones(self, api, theirs):
        unknown = api.get(f"{URL}00000000-0000-0000-0000-000000000000/")
        foreign = api.get(f"{URL}{theirs.pk}/")

        def shape(response):
            body = response.json()
            body.get("error", {}).pop("request_id", None)
            return response.status_code, body

        assert shape(foreign) == shape(unknown)
        assert foreign.status_code == 404

    def test_search_does_not_reach_other_projects(self, api, mine, theirs):
        assert _ids(api.get(URL, {"search": "Theirs"})) == set()
        assert _ids(api.get(URL, {"search": "Mine"})) == {str(mine.pk)}

    def test_a_legacy_job_without_a_project_is_not_visible_to_a_member(self, api, legacy):
        assert api.get(f"{URL}{legacy.pk}/").status_code == 404

    def test_leaving_the_project_takes_effect_on_the_next_request(self, api, user, mine, project):
        assert api.get(f"{URL}{mine.pk}/").status_code == 200

        ProjectMembership.objects.filter(user=user, project=project).update(status="inactive")

        assert api.get(f"{URL}{mine.pk}/").status_code == 404
        assert api.get(URL).json()["results"] == []


class TestWritingToOtherProjects:
    @pytest.mark.parametrize(
        ("method", "suffix", "body"),
        [
            ("get", "", None),
            ("patch", "", {"name": "x"}),
            ("put", "", {"name": "x"}),
            ("delete", "", None),
            ("post", "validate/", {}),
            ("post", "retry/", {}),
            ("post", "republish/", {}),
            ("post", "unpublish/", {"reason": "x"}),
            ("post", "start-export/", {}),
            ("post", "complete-export/", {}),
            ("post", "fail/", {"reason": "x"}),
        ],
    )
    def test_every_action_on_a_foreign_job_is_404_and_changes_nothing(
        self, api, theirs, method, suffix, body
    ):
        before = PublishItem.all_objects.filter(pk=theirs.pk).values().get()

        response = getattr(api, method)(f"{URL}{theirs.pk}/{suffix}", body, format="json")

        assert response.status_code == 404
        assert PublishItem.all_objects.filter(pk=theirs.pk).values().get() == before
        assert PublishItem.objects.count() == 1

    def test_creating_in_a_project_you_are_not_in_looks_like_an_unknown_project(self, api, user):
        foreign = ProjectFactory.create(code="FOREIGNJ")

        in_foreign = api.post(URL, {**BODY, "project_id": str(foreign.pk)}, format="json")
        unknown = api.post(
            URL, {**BODY, "project_id": "00000000-0000-0000-0000-000000000000"}, format="json"
        )

        def without_request_id(response):
            body = response.json()
            body.get("error", {}).pop("request_id", None)
            return body

        assert in_foreign.status_code == unknown.status_code == 400
        assert without_request_id(in_foreign) == without_request_id(unknown)
        assert "Unknown project" in in_foreign.content.decode()
        assert PublishItem.objects.count() == 0

    def test_a_version_of_another_project_is_refused(self, api, project):
        foreign = published_version(ProjectFactory.create(code="FOREIGNV"))

        response = api.post(
            URL,
            {**BODY, "project_id": str(project.pk), "version_id": str(foreign.pk)},
            format="json",
        )

        assert response.status_code == 400
        assert "Unknown version" in response.content.decode()

    def test_a_version_in_a_foreign_project_alone_is_refused_too(self, api):
        foreign = published_version(ProjectFactory.create(code="FOREIGNW"))

        assert api.post(
            URL, {"name": "n", "dcc_tool": "Maya", "source_file": "a", "version_id": str(foreign.pk)},
            format="json",
        ).status_code == 400  # fmt: skip


class TestCreateNeedsAProject:
    def test_a_member_must_name_one(self, api):
        response = api.post(URL, {**BODY, "code": "NOPROJECT-1"}, format="json")

        assert response.status_code == 400
        assert "A project is required" in response.content.decode()
        assert PublishItem.objects.count() == 0

    def test_a_platform_admin_may_leave_it_out_when_sending_a_code(self):
        admin = outsider(*ALL)
        admin.is_superuser = True
        admin.save()

        response = client_for(admin).post(URL, {**BODY, "code": "ADMIN-1"}, format="json")

        assert response.status_code == 201

    def test_the_version_can_supply_the_project(self, api, project):
        version = published_version(project, shot=ShotFactory.create(project=project, code="SH070"))

        response = api.post(
            URL,
            {"name": "n", "dcc_tool": "Maya", "source_file": "a", "version_id": str(version.pk)},
            format="json",
        )

        assert response.status_code == 201
        assert PublishItem.objects.get(pk=response.json()["id"]).project_id == project.pk

    def test_the_project_may_be_named_by_code(self, api, project):
        assert api.post(URL, {**BODY, "project_id": project.code}, format="json").status_code == 201


class TestEachActionNeedsItsCode:
    # action -> (method, suffix, body, the code that opens it)
    CASES = {
        "list": ("get", "", None, P.VIEW),
        "retrieve": ("get", "{id}/", None, P.VIEW),
        "create": ("post", "", "create", P.CREATE),
        "update": ("put", "{id}/", {"name": "x"}, P.UPDATE),
        "partial_update": ("patch", "{id}/", {"name": "x"}, P.UPDATE),
        "destroy": ("delete", "{id}/", None, P.DELETE),
        "validate": ("post", "{id}/validate/", {}, P.UPDATE),
        "retry": ("post", "{id}/retry/", {}, P.UPDATE),
        "republish": ("post", "{id}/republish/", {}, P.UPDATE),
        "unpublish": ("post", "{id}/unpublish/", {}, P.UPDATE),
        "start_export": ("post", "{id}/start-export/", {}, P.UPDATE),
        "complete_export": ("post", "{id}/complete-export/", {}, P.UPDATE),
        "fail": ("post", "{id}/fail/", {"reason": "x"}, P.UPDATE),
    }

    @pytest.mark.parametrize("name", sorted(CASES))
    def test_without_the_code_it_is_403_even_for_a_member(self, project, mine, name):
        method, path, body, needed = self.CASES[name]
        everything_else = {code for code in ALL} - {needed}
        client = client_for(member(project, *everything_else))
        if body == "create":
            body = {**BODY, "project_id": str(project.pk), "code": "X-1"}

        response = getattr(client, method)(URL + path.format(id=mine.pk), body, format="json")

        assert response.status_code == 403, name

    def test_the_cases_cover_every_action_the_viewset_maps(self):
        from apps.publishing.api.viewsets.publish import PublishingViewSet

        assert set(self.CASES) == set(PublishingViewSet.permission_map)


class TestScopedCredentials:
    """A key or token acts as its owner but only with the codes it lists."""

    def _client(self, user, *scopes):
        client = APIClient()
        key = ApiKey(scopes=list(scopes))
        client.force_authenticate(user=user, token=key)  # pyright: ignore[reportArgumentType]
        return client

    def test_a_key_limited_to_view_cannot_create_or_update(self, project, mine):
        owner = member(project, *ALL)
        client = self._client(owner, P.VIEW)

        assert client.get(URL).status_code == 200
        assert (
            client.post(URL, {**BODY, "project_id": str(project.pk)}, format="json").status_code
            == 403
        )
        assert client.patch(f"{URL}{mine.pk}/", {"name": "x"}, format="json").status_code == 403

    def test_a_key_cannot_exceed_what_its_owner_holds(self, project, mine):
        owner = member(project, P.VIEW)
        client = self._client(owner, P.VIEW, P.UPDATE)

        assert client.post(f"{URL}{mine.pk}/validate/", {}, format="json").status_code == 403

    def test_a_key_acts_inside_its_owners_projects_only(self, project, mine, theirs):
        owner = member(project, *ALL)
        client = self._client(owner, P.VIEW, P.UPDATE)

        assert _ids(client.get(URL)) == {str(mine.pk)}
        assert client.post(f"{URL}{theirs.pk}/validate/", {}, format="json").status_code == 404

    def test_the_status_override_must_be_in_the_keys_scopes(self, project):
        from apps.publishing.services.workflow import JobService
        from apps.publishing.tests.helpers import request_for  # noqa: F401

        owner = member(project, P.VIEW, P.UPDATE, P.STATUS_OVERRIDE)
        job = create_job(actor=None, data={**BODY, "project_id": str(project.pk)})
        PublishItem.objects.filter(pk=job.pk).update(status="Cancelled")

        class Request:
            user = owner
            auth = ApiKey(scopes=[P.VIEW, P.UPDATE])  # the override is not listed

        from apps.publishing.exceptions import TransitionNotPermitted

        with pytest.raises(TransitionNotPermitted):
            JobService.move(
                actor=owner, job=job, target="Pending", request=Request(), override_reason="x"
            )
