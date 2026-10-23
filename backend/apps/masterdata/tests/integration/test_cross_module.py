"""Masterdata alongside the apps that depend on it (PLAN WP 8.1).

1. Identity permissions guard **every** masterdata write: every non-safe operation of every
   masterdata route refuses an anonymous caller (401) and an authenticated caller who holds no
   permission (403). The routes come from the OpenAPI endpoint list, so a new route is covered
   without editing this file.
2. Rows other apps point at are real references: soft-deleting a department, team, client, ... is
   refused while production, scheduling or deliveries rows still use it, and those apps keep
   reading them.
"""

from __future__ import annotations

import uuid

import pytest
from drf_spectacular.generators import EndpointEnumerator
from rest_framework.test import APIClient

from apps.deliveries.models import DeliveryPackage
from apps.identity.tests.factories import UserFactory
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.services.organization import DepartmentService, TeamService
from apps.masterdata.services.partner import ClientService
from apps.masterdata.tests.factories import ClientFactory, DepartmentFactory, TeamFactory
from apps.production.tests.factories import AssetFactory, TaskFactory
from apps.scheduling.models import Resource

pytestmark = pytest.mark.django_db

ROUTE_PREFIXES = (
    "/api/v1/platform/",
    *(
        f"/api/v1/{name}/"
        for name in (
            "departments",
            "teams",
            "offices",
            "positions",
            "people",
            "clients",
            "vendors",
            "client-contacts",
            "vendor-contacts",
            "client-contracts",
            "vendor-contracts",
        )
    ),
)
WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")


def write_operations():
    ops = []
    for path, _regex, method, _callback in EndpointEnumerator().get_api_endpoints():
        if method in WRITE_METHODS and path.startswith(ROUTE_PREFIXES):
            ops.append((method, path))
    return sorted(set(ops))


OPERATIONS = write_operations()


def concrete(path: str) -> str:
    """Fill every path parameter with a random UUID (the check must come before any lookup)."""
    out = path
    while "{" in out:
        start = out.index("{")
        out = out[:start] + str(uuid.uuid4()) + out[out.index("}") + 1 :]
    return out


def test_the_route_walk_finds_the_write_operations():
    # Guards the guard: if the enumerator found nothing, the tests below would prove nothing.
    assert len(OPERATIONS) > 100
    assert ("DELETE", "/api/v1/platform/master-data/task-types/{pk}") in OPERATIONS
    assert ("POST", "/api/v1/client-contracts/{pk}/adjust-end-date/") in OPERATIONS
    assert ("POST", "/api/v1/people/{pk}/link-user/") in OPERATIONS


@pytest.mark.parametrize(("method", "path"), OPERATIONS, ids=[f"{m} {p}" for m, p in OPERATIONS])
class TestEveryWriteIsGuarded:
    def test_anonymous_is_401(self, method, path):
        api = APIClient(raise_request_exception=False)
        response = api.generic(method, concrete(path), data="{}", content_type="application/json")
        assert response.status_code == 401, response.content

    def test_an_authenticated_user_without_permissions_is_403(self, method, path):
        api = APIClient(raise_request_exception=False)
        api.force_authenticate(user=UserFactory.create())
        response = api.generic(method, concrete(path), data="{}", content_type="application/json")
        assert response.status_code == 403, response.content


class TestOtherAppsKeepReferencingMasterdata:
    def test_a_department_used_by_an_asset_cannot_be_deleted(self):
        department = DepartmentFactory()
        AssetFactory(department=department)
        with pytest.raises(MasterdataConflict) as caught:
            DepartmentService.soft_delete(actor=UserFactory.create(), instance=department)
        assert caught.value.code == "has_dependants"
        assert "production.Asset.department" in str(caught.value.detail)

    def test_a_team_used_by_a_task_cannot_be_deleted(self):
        team = TeamFactory()
        TaskFactory(team=team)
        with pytest.raises(MasterdataConflict) as caught:
            TeamService.soft_delete(actor=UserFactory.create(), instance=team)
        assert "production.Task.team" in str(caught.value.detail)

    def test_scheduling_resources_keep_their_department_and_team(self):
        team = TeamFactory()
        resource = Resource.objects.create(
            name="Artist A", code="RES-A", department=team.department, team=team
        )
        resource.refresh_from_db()
        assert resource.department_id == team.department_id and resource.team_id == team.pk
        with pytest.raises(MasterdataConflict) as caught:
            TeamService.soft_delete(actor=UserFactory.create(), instance=team)
        assert "scheduling.Resource.team" in str(caught.value.detail)

    def test_a_client_with_a_delivery_package_cannot_be_deleted(self):
        client = ClientFactory()
        DeliveryPackage.objects.create(name="Pkg", code="DEL-1", client=client)
        with pytest.raises(MasterdataConflict) as caught:
            ClientService.soft_delete(actor=UserFactory.create(), instance=client)
        assert caught.value.code == "has_dependants"
        assert "deliveries.DeliveryPackage.client" in str(caught.value.detail)

    def test_after_the_references_go_the_delete_works(self):
        client = ClientFactory()
        package = DeliveryPackage.objects.create(name="Pkg", code="DEL-2", client=client)
        DeliveryPackage.objects.filter(pk=package.pk).update(client=None)
        ClientService.soft_delete(actor=UserFactory.create(), instance=client)

    def test_the_apps_read_the_directory_through_the_foreign_keys(self):
        team = TeamFactory()
        asset = AssetFactory(department=team.department)
        assert asset.department.pk == team.department_id
        assert list(team.department.teams.all()) == [team]
