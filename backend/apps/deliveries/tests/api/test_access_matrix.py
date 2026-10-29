# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Who may touch which delivery (SEC-DLV-01, API-DLV-01/02): deliveries are narrowed to the caller's
projects and anything else is a 404 exactly like an unknown id; every action needs its own code;
a scoped key acts as its owner but only with the codes it lists.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.deliveries.api.viewsets.delivery import DeliveryViewSet
from apps.deliveries.constants.permissions import DeliveryPermissions as P
from apps.deliveries.models import DeliveryDestination, DeliveryPackage
from apps.deliveries.tests.helpers import (
    DELIVERY_CODES,
    client_for,
    make_package,
    operator,
    outsider,
    package_with_items,
    prepared_package,
    signed_off_package,
)
from apps.identity.models import ApiKey
from apps.masterdata.tests.factories import ClientFactory
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/deliveries/"
UNKNOWN = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def project():
    return ProjectFactory.create(code="MINE")


@pytest.fixture
def user(project):
    return operator(project, *DELIVERY_CODES)


@pytest.fixture
def api(user):
    return client_for(user)


@pytest.fixture
def mine(project):
    return make_package(project, code="MINE-1", name="Mine")


@pytest.fixture
def theirs():
    return make_package(ProjectFactory.create(code="THEIRS"), code="THEIRS-1", name="Theirs")


@pytest.fixture
def legacy():
    """An old delivery that names no project."""
    return DeliveryPackage.objects.create(name="Legacy", code="LEGACY-1")


def _ids(response):
    return {row["id"] for row in response.json()["results"]}


def _shape(response):
    body = response.json()
    body.get("error", {}).pop("request_id", None)
    return response.status_code, body


class TestReading:
    def test_a_member_sees_their_projects_deliveries_only(self, api, mine, theirs, legacy):
        assert _ids(api.get(URL)) == {str(mine.pk)}

    def test_a_platform_admin_sees_every_delivery_including_legacy_ones(self, mine, theirs, legacy):
        admin = outsider(*DELIVERY_CODES, superuser=True)

        assert _ids(client_for(admin).get(URL)) == {str(mine.pk), str(theirs.pk), str(legacy.pk)}

    def test_a_non_member_sees_nothing(self, mine):
        stranger = client_for(outsider(*DELIVERY_CODES))

        assert stranger.get(URL).json()["results"] == []

    def test_other_projects_ids_are_404_exactly_like_unknown_ones(self, api, theirs):
        unknown = api.get(f"{URL}{UNKNOWN}/")
        foreign = api.get(f"{URL}{theirs.pk}/")

        assert foreign.status_code == 404 and _shape(foreign) == _shape(unknown)

    def test_search_does_not_reach_other_projects(self, api, mine, theirs):
        assert _ids(api.get(URL, {"search": "Theirs"})) == set()
        assert _ids(api.get(URL, {"search": "Mine"})) == {str(mine.pk)}

    def test_a_legacy_delivery_without_a_project_is_not_visible_to_a_member(self, api, legacy):
        assert api.get(f"{URL}{legacy.pk}/").status_code == 404

    def test_leaving_the_project_takes_effect_on_the_next_request(self, api, user, mine, project):
        assert api.get(f"{URL}{mine.pk}/").status_code == 200

        ProjectMembership.objects.filter(user=user, project=project).update(status="inactive")

        assert api.get(f"{URL}{mine.pk}/").status_code == 404
        assert api.get(URL).json()["results"] == []

    def test_an_artist_with_only_view_still_sees_only_their_project(self, project, mine, theirs):
        artist = client_for(operator(project, "delivery.view"))

        assert _ids(artist.get(URL)) == {str(mine.pk)}
        assert artist.get(f"{URL}{theirs.pk}/").status_code == 404


class TestEveryActionOnAForeignDelivery:
    @pytest.mark.parametrize(
        ("method", "suffix", "body"),
        [
            ("get", "", None),
            ("patch", "", {"name": "x"}),
            ("put", "", {"name": "x"}),
            ("delete", "", None),
            ("post", "add-version/", {"version_id": UNKNOWN}),
            ("post", "remove-version/", {"version_ref_id": 1}),
            ("post", "validate/", {}),
            ("post", "retry/", {}),
            ("post", "prepare/", {}),
            ("post", "sign-off/", {}),
            ("post", "reopen/", {}),
            ("post", "submit/", {}),
            ("post", "approve/", {}),
            ("post", "reject/", {"rejection_reason": "x"}),
            ("post", "complete/", {}),
            ("post", "cancel/", {}),
            ("post", "revise/", {}),
            ("get", "history/", None),
            ("get", "qc/", None),
            ("get", "passcode/", None),
        ],
    )
    def test_it_is_a_404_and_changes_nothing(self, api, theirs, method, suffix, body):
        before = DeliveryPackage.all_objects.filter(pk=theirs.pk).values().get()

        response = getattr(api, method)(f"{URL}{theirs.pk}/{suffix}", body, format="json")

        assert response.status_code == 404, (method, suffix, response.content)
        assert DeliveryPackage.all_objects.filter(pk=theirs.pk).values().get() == before
        assert DeliveryPackage.objects.filter(revision_of=theirs).count() == 0

    def test_every_action_the_viewset_maps_is_in_the_list_above(self):
        # the extra actions come from the viewset; the standard ones are list/create
        extra = {
            getattr(a, "url_path", "")
            for a in DeliveryViewSet.get_extra_actions()
            if getattr(a, "detail", False)
        }
        covered = {
            "add-version", "remove-version", "validate", "retry", "prepare", "sign-off", "reopen",
            "submit", "approve", "reject", "complete", "cancel", "revise", "history", "qc",
            "passcode",
        }  # fmt: skip
        assert extra == covered


class TestCreating:
    def test_a_foreign_project_looks_like_an_unknown_one(self, api):
        foreign = ProjectFactory.create(code="FOREIGND")

        in_foreign = api.post(URL, {"name": "x", "project_id": str(foreign.pk)}, format="json")
        unknown = api.post(URL, {"name": "x", "project_id": UNKNOWN}, format="json")

        assert in_foreign.status_code == unknown.status_code == 400
        assert _shape(in_foreign) == _shape(unknown)
        assert "Unknown project" in in_foreign.content.decode()
        assert DeliveryPackage.objects.count() == 0

    def test_a_member_must_name_a_project(self, api):
        response = api.post(URL, {"name": "x", "code": "NOPROJECT-1"}, format="json")

        assert response.status_code == 400
        assert "A project is required" in response.content.decode()

    def test_a_platform_admin_may_leave_it_out_when_sending_a_code(self):
        admin = client_for(outsider(*DELIVERY_CODES, superuser=True))

        response = admin.post(URL, {"name": "x", "code": "ADMIN-1"}, format="json")

        assert response.status_code == 201

    def test_the_project_may_be_named_by_code(self, api, project):
        response = api.post(URL, {"name": "x", "project_id": project.code}, format="json")

        assert response.status_code == 201 and response.json()["code"] == "DLV-MINE-0001"

    def test_an_unknown_inactive_or_deleted_client_is_a_400(self, api, project):
        inactive = ClientFactory.create(status="Inactive")
        deleted = ClientFactory.create()
        type(deleted).objects.filter(pk=deleted.pk).update(is_deleted=True)

        for client_id in (UNKNOWN, str(inactive.pk), str(deleted.pk)):
            response = api.post(
                URL,
                {"name": "x", "project_id": str(project.pk), "client_id": client_id},
                format="json",
            )
            assert response.status_code == 400 and "Unknown client" in response.content.decode()

        active = ClientFactory.create(status="Active")
        ok = api.post(
            URL,
            {"name": "x", "project_id": str(project.pk), "client_id": str(active.pk)},
            format="json",
        )
        assert ok.status_code == 201

    def test_a_version_of_another_project_cannot_be_added(self, api, mine):
        from apps.deliveries.tests.helpers import published_version

        foreign = published_version(ProjectFactory.create(code="FOREIGNV"))

        response = api.post(
            f"{URL}{mine.pk}/add-version/", {"version_id": str(foreign.pk)}, format="json"
        )

        assert response.status_code == 400 and mine.versions.count() == 0


class TestEachActionNeedsItsCode:
    # permission_map name -> (method, path suffix, body, the code that opens it)
    CASES = {
        "list": ("get", "", None, P.VIEW),
        "retrieve": ("get", "{id}/", None, P.VIEW),
        "history": ("get", "{id}/history/", None, P.VIEW),
        "qc": ("get", "{id}/qc/", None, P.VIEW),
        "create": ("post", "", {"name": "x", "code": "X-1"}, P.CREATE),
        "update": ("put", "{id}/", {"name": "x"}, P.UPDATE),
        "partial_update": ("patch", "{id}/", {"name": "x"}, P.UPDATE),
        "destroy": ("delete", "{id}/", None, P.DELETE),
        "add_version": ("post", "{id}/add-version/", {"version_id": UNKNOWN}, P.UPDATE),
        "remove_version": ("post", "{id}/remove-version/", {"version_ref_id": 1}, P.UPDATE),
        "validate": ("post", "{id}/validate/", {}, P.UPDATE),
        "prepare": ("post", "{id}/prepare/", {}, P.UPDATE),
        "retry": ("post", "{id}/retry/", {}, P.UPDATE),
        "complete": ("post", "{id}/complete/", {}, P.UPDATE),
        "cancel": ("post", "{id}/cancel/", {}, P.UPDATE),
        "bulk_cancel": ("post", "bulk-cancel/", {"ids": [UNKNOWN]}, P.UPDATE),
        "sign_off": ("post", "{id}/sign-off/", {}, P.APPROVE),
        "reopen": ("post", "{id}/reopen/", {}, P.APPROVE),
        "submit": ("post", "{id}/submit/", {}, P.SEND),
        "approve": ("post", "{id}/approve/", {}, P.SEND),
        "reject": ("post", "{id}/reject/", {"rejection_reason": "x"}, P.SEND),
        "revise": ("post", "{id}/revise/", {}, P.SEND),
        "passcode": ("get", "{id}/passcode/", None, P.VIEW_SECRET),
    }

    @pytest.mark.parametrize("name", sorted(CASES))
    def test_without_the_code_it_is_403_even_for_a_member(self, project, mine, name):
        method, path, body, needed = self.CASES[name]
        everything_else = set(DELIVERY_CODES) - {needed}
        client = client_for(operator(project, *everything_else))

        response = getattr(client, method)(URL + path.format(id=mine.pk), body, format="json")

        assert response.status_code == 403, name

    def test_the_cases_cover_every_action_the_viewset_maps(self):
        assert set(self.CASES) == set(DeliveryViewSet.permission_map)

    def test_each_case_names_the_code_the_viewset_maps(self):
        for name, (_, _, _, needed) in self.CASES.items():
            assert DeliveryViewSet.permission_map[name] == (needed,), name

    def test_a_holder_of_only_the_right_code_gets_through_to_the_service(self, project):
        package = prepared_package(project, code="ONLY-1")
        signer = client_for(operator(project, P.VIEW, P.APPROVE))

        response = signer.post(f"{URL}{package.pk}/sign-off/", {}, format="json")

        assert response.status_code == 200 and response.json()["status"] == "Signed Off"

    def test_anonymous_callers_are_refused(self, mine):
        anonymous = APIClient()

        assert anonymous.get(URL).status_code in (401, 403)
        assert anonymous.post(f"{URL}{mine.pk}/sign-off/", {}, format="json").status_code in (
            401,
            403,
        )


class TestSignedOffDeliveriesAndTheirCodes:
    def test_cancelling_a_signed_off_delivery_needs_approve_even_though_cancel_maps_to_update(
        self, project
    ):
        package = signed_off_package(project)
        editor = client_for(operator(project, P.VIEW, P.UPDATE))

        assert editor.post(f"{URL}{package.pk}/cancel/", {}, format="json").status_code == 403
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Signed Off"


class TestScopedCredentials:
    """A key or token acts as its owner but only with the codes it lists."""

    def _client(self, user, *scopes):
        client = APIClient()
        client.force_authenticate(user=user, token=ApiKey(scopes=list(scopes)))  # pyright: ignore[reportArgumentType]
        return client

    def test_a_key_limited_to_view_cannot_create_or_update(self, project, mine):
        owner = operator(project, *DELIVERY_CODES)
        client = self._client(owner, P.VIEW)

        assert client.get(URL).status_code == 200
        assert (
            client.post(
                URL, {"name": "x", "project_id": str(project.pk)}, format="json"
            ).status_code
            == 403
        )
        assert client.patch(f"{URL}{mine.pk}/", {"name": "x"}, format="json").status_code == 403

    def test_a_key_cannot_exceed_what_its_owner_holds(self, project, mine):
        owner = operator(project, P.VIEW)
        client = self._client(owner, P.VIEW, P.UPDATE)

        assert client.post(f"{URL}{mine.pk}/validate/", {}, format="json").status_code == 403

    def test_a_key_acts_inside_its_owners_projects_only(self, project, mine, theirs):
        owner = operator(project, *DELIVERY_CODES)
        client = self._client(owner, P.VIEW, P.UPDATE)

        assert _ids(client.get(URL)) == {str(mine.pk)}
        assert client.post(f"{URL}{theirs.pk}/validate/", {}, format="json").status_code == 404

    def test_a_key_without_the_secret_scope_cannot_read_the_passcode(self, project):
        package = make_package(project, code="KEY-PC", passcode="SECRET-FOR-KEY-77")
        owner = operator(project, P.VIEW, P.VIEW_SECRET)

        without = self._client(owner, P.VIEW)
        with_scope = self._client(owner, P.VIEW, P.VIEW_SECRET)

        assert without.get(f"{URL}{package.pk}/passcode/").status_code == 403
        assert with_scope.get(f"{URL}{package.pk}/passcode/").json() == {
            "passcode": "SECRET-FOR-KEY-77"
        }

    def test_a_key_that_does_not_list_a_code_cannot_sign_off(self, project):
        package = prepared_package(project, code="KEY-SO")
        owner = operator(project, P.VIEW, P.APPROVE)

        assert (
            self._client(owner, P.VIEW)
            .post(f"{URL}{package.pk}/sign-off/", {}, format="json")
            .status_code
            == 403
        )

    def test_the_override_codes_must_be_in_the_keys_scopes(self, project):
        from apps.deliveries.exceptions import SeparationOfDuties
        from apps.deliveries.services.package import DeliveryService

        owner = operator(project, P.VIEW, P.APPROVE, P.SOD_OVERRIDE)
        package = package_with_items(project, code="KEY-OV")
        DeliveryService.prepare(actor=owner, package=package)

        class Request:
            user = owner
            auth = ApiKey(scopes=[P.VIEW, P.APPROVE])  # the override is not listed

        with pytest.raises(SeparationOfDuties):
            DeliveryService.sign_off(
                actor=owner, package=package, request=Request(), override_reason="my own work"
            )


class TestDestinationsAreStudioWide:
    def test_any_member_with_view_reads_them_and_the_codes_still_apply(self, project):
        DeliveryDestination.objects.create(
            name="Studio S3", destination_type="AWS S3 Bucket", endpoint="s3://x"
        )
        viewer = client_for(operator(project, P.VIEW))
        stranger = client_for(outsider(P.VIEW))

        assert viewer.get(f"{URL}destinations/").json()["results"][0]["name"] == "Studio S3"
        assert stranger.get(f"{URL}destinations/").status_code == 200
        assert viewer.post(f"{URL}destinations/", {"name": "n"}, format="json").status_code == 403
        assert client_for(outsider()).get(f"{URL}destinations/").status_code == 403
