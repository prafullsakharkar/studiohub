"""
Cross-cutting API contract regression tests (Phase 7).

Locks the documented contract (docs/api/REAL_API.md) in place:
HTTP methods per route, response fields/types, pagination envelopes,
filter/search/ordering params, error envelopes, and the seed permission
matrix. Any intentional breaking change must update the contract docs
AND this module together — silent drift fails here first.

Domain imports are lazy (inside tests) so Core stays runtime-dependency
free; test-only imports do not create architecture dependencies.

Organization scoping uses the same header the frontend sends
(X-Organization-ID), attached via ``_scoped``.
"""

from __future__ import annotations

import pytest


def _scoped(client, org):
    """Attach the frontend's organization header to a test client."""
    client.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))
    return client


class TestContractMethods:
    """Wrong HTTP methods must 405, never silently succeed or 500."""

    @pytest.mark.django_db
    def test_bulk_create_rejects_get(self, staff_client):
        from apps.production.tests.factories import ProjectFactory

        project = ProjectFactory.create()
        resp = _scoped(staff_client, project.organization).get(
            "/api/v1/shots/bulk-create/"
        )
        assert resp.status_code == 405

    @pytest.mark.django_db
    def test_list_rejects_delete(self, staff_client):
        resp = staff_client.delete("/api/v1/shots/")
        assert resp.status_code == 405

    @pytest.mark.django_db
    def test_action_rejects_get(self, staff_client):
        from apps.production.tests.factories import ShotFactory

        shot = ShotFactory.create()
        resp = _scoped(staff_client, shot.organization).get(
            f"/api/v1/shots/{shot.id}/approve/"
        )
        assert resp.status_code == 405

    @pytest.mark.django_db
    def test_archive_rejects_put(self, staff_client):
        from apps.production.tests.factories import ShotFactory

        shot = ShotFactory.create()
        resp = _scoped(staff_client, shot.organization).put(
            f"/api/v1/shots/{shot.id}/archive/", {}, format="json"
        )
        assert resp.status_code == 405


class TestContractResponseShapes:
    """List/detail payloads carry the documented fields with stable types.

    Catches renamed fields and incompatible type changes.
    """

    @pytest.mark.django_db
    def test_project_list_and_detail_shape(self, staff_client, staff_user):
        from apps.organization.tests.rbac_helpers import grant_org_admin
        from apps.production.tests.factories import ProjectFactory

        project = ProjectFactory.create()
        grant_org_admin(staff_user, project.organization)
        client = _scoped(staff_client, project.organization)

        item = client.get("/api/v1/projects/").json()["results"][0]
        assert isinstance(item["id"], str)
        assert isinstance(item["code"], str) and item["code"]
        assert isinstance(item["name"], str) and item["name"]
        assert "status" in item

        detail = client.get(f"/api/v1/projects/{project.id}/").json()
        assert detail["id"] == str(project.id)
        assert detail["code"] == project.code
        assert isinstance(detail["name"], str)

    @pytest.mark.django_db
    def test_shot_list_and_detail_shape(self, staff_client, staff_user):
        from apps.organization.tests.rbac_helpers import grant_org_admin
        from apps.production.tests.factories import ShotFactory

        shot = ShotFactory.create()
        grant_org_admin(staff_user, shot.organization)
        client = _scoped(staff_client, shot.organization)

        item = client.get("/api/v1/shots/").json()["results"][0]
        assert isinstance(item["id"], str)
        assert isinstance(item["code"], str) and item["code"]
        assert isinstance(item["name"], str)
        assert "status" in item

        detail = client.get(f"/api/v1/shots/{shot.id}/").json()
        assert detail["id"] == str(shot.id)
        assert detail["code"] == shot.code

    @pytest.mark.django_db
    def test_nested_team_list_shape(self, staff_client, staff_user):
        from apps.organization.tests.factories import TeamFactory
        from apps.organization.tests.rbac_helpers import grant_all_known_codes

        team = TeamFactory.create()
        grant_all_known_codes(staff_user, organization=team.organization)
        resp = _scoped(staff_client, team.organization).get(
            f"/api/organizations/{team.organization.id}/teams/"
        )
        assert resp.status_code == 200
        rows = resp.json()
        assert isinstance(rows, list) and len(rows) == 1
        assert rows[0]["code"] == team.code
        assert isinstance(rows[0]["name"], str)
        assert "uuid" in rows[0]

    @pytest.mark.django_db
    def test_organization_list_shape(self, staff_client, staff_user):
        from apps.organization.tests.factories import (
            OrganizationFactory,
            OrganizationMembershipFactory,
        )

        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=staff_user, organization=org)
        rows = _scoped(staff_client, org).get("/api/v1/organizations/").json()
        rows = rows["results"] if isinstance(rows, dict) else rows
        match = [r for r in rows if r["id"] == str(org.id)]
        assert match, "created org missing from directory"
        assert match[0]["code"] == org.code
        assert isinstance(match[0]["name"], str)

    @pytest.mark.django_db
    def test_memberships_shape(self, staff_user, staff_client):
        from apps.organization.tests.factories import (
            OrganizationFactory,
            OrganizationMembershipFactory,
        )

        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=staff_user, organization=org)
        rows = staff_client.get("/api/v1/users/me/memberships/").json()
        assert isinstance(rows, list) and len(rows) == 1
        row = rows[0]
        assert row["organization_id"] == str(org.id)
        assert isinstance(row["role"], str)
        assert isinstance(row["permissions"], list)
        assert row["status"] == "Active"

    @pytest.mark.django_db
    def test_knowledge_list_and_detail_shape(self, staff_client, staff_user):
        from apps.intelligence.tests.factories import KnowledgeDocumentFactory
        from apps.organization.tests.factories import OrganizationMembershipFactory

        doc = KnowledgeDocumentFactory.create()
        OrganizationMembershipFactory.create(
            user=staff_user, organization=doc.organization
        )
        client = _scoped(staff_client, doc.organization)

        rows = client.get("/api/v1/intelligence/knowledge/").json()
        assert isinstance(rows, list) and len(rows) == 1
        assert rows[0]["title"] == doc.title
        assert isinstance(rows[0]["slug"], str)

        detail = client.get(f"/api/v1/intelligence/knowledge/{doc.id}/").json()
        assert detail["id"] == str(doc.id)
        assert isinstance(detail["content_markdown"], str)


class TestContractEnvelopes:
    """Paginated vs bare-array envelope matrix (docs/api/REAL_API.md)."""

    @pytest.mark.django_db
    def test_paginated_envelope(self, staff_client):
        from apps.production.tests.factories import ProjectFactory

        project = ProjectFactory.create()
        data = _scoped(staff_client, project.organization).get("/api/v1/projects/").json()
        assert {"count", "next", "previous", "results"} <= set(data.keys())
        assert isinstance(data["results"], list)

    @pytest.mark.django_db
    def test_bare_array_envelopes(self, staff_client):
        from apps.organization.tests.factories import TeamFactory

        team = TeamFactory.create()
        client = _scoped(staff_client, team.organization)

        teams = client.get(f"/api/organizations/{team.organization.id}/teams/").json()
        assert isinstance(teams, list)

        media = client.get("/api/v1/media/").json()
        assert isinstance(media, list)

        attachments = client.get("/api/v1/attachments/").json()
        assert isinstance(attachments, list)


class TestContractErrors:
    """Error envelopes stay stable: 401/404 carry {detail}, 400 carries
    field errors, cross-org access never leaks (403/404, never 200/500)."""

    @pytest.mark.django_db
    def test_unauthenticated_is_401_with_detail(self, api_client):
        resp = api_client.get("/api/v1/shots/")
        assert resp.status_code == 401
        assert "detail" in resp.json()

    @pytest.mark.django_db
    def test_unknown_id_is_404_with_detail(self, staff_client):
        from uuid import uuid4

        from apps.production.tests.factories import ProjectFactory

        project = ProjectFactory.create()
        resp = _scoped(staff_client, project.organization).get(f"/api/v1/shots/{uuid4()}/")
        assert resp.status_code == 404
        assert "detail" in resp.json()

    @pytest.mark.django_db
    def test_invalid_create_is_400_with_field_errors(self, staff_client):
        from apps.production.tests.factories import ProjectFactory

        project = ProjectFactory.create()
        resp = _scoped(staff_client, project.organization).post(
            "/api/v1/shots/", {}, format="json"
        )
        assert resp.status_code == 400
        body = resp.json()
        assert isinstance(body, dict) and body, "expected field-error mapping"
        assert any(isinstance(v, list) for v in body.values())

    @pytest.mark.django_db
    def test_cross_org_nested_denied_without_leak(self, db):
        from rest_framework.test import APIClient

        from apps.identity.tests.factories import UserFactory
        from apps.organization.tests.factories import (
            OrganizationFactory,
            TeamFactory,
        )

        team = TeamFactory.create()
        outsider = UserFactory.create()
        OrganizationFactory.create()  # unrelated org exists
        client = APIClient()
        client.force_authenticate(user=outsider)

        resp = _scoped(client, team.organization).get(
            f"/api/organizations/{team.organization.id}/teams/"
        )
        assert resp.status_code in (401, 403, 404)
        if resp.status_code == 200:  # pragma: no cover - must never happen
            assert resp.json() == []


class TestContractPermissionMatrix:
    """The seed permission matrix must cover every enforced permission code.

    Phase 6 found zero roles held any organization-domain code, locking every
    non-superuser out of the org API. This test fails if enforcement and the
    seed catalog drift apart again.
    """

    def _enforced_codes(self):
        from apps.organization.api.viewsets import (
            client,
            department,
            office,
            organization,
            person,
            position,
            team,
            vendor,
        )
        from apps.production.api.viewsets import asset, project, shot, task

        viewsets = [
            organization.OrganizationViewSet,
            client.ClientViewSet,
            vendor.VendorViewSet,
            department.DepartmentViewSet,
            team.TeamViewSet,
            office.OfficeViewSet,
            person.PersonViewSet,
            position.PositionViewSet,
            project.ProjectViewSet,
            shot.ShotViewSet,
            asset.AssetViewSet,
            task.TaskViewSet,
        ]
        codes = set()
        for viewset in viewsets:
            for action_codes in vars(viewset).get("permission_map", {}).values():
                codes.update(action_codes)
        return codes

    @pytest.mark.django_db
    def test_seed_catalog_covers_enforced_codes(self, db):
        from apps.core.management.commands.seed_dev import Command

        enforced = self._enforced_codes()
        assert enforced, "no permission_map codes collected"
        catalog = {p.code for p in Command()._seed_permissions()}
        assert enforced <= catalog, f"enforced but unseeded: {enforced - catalog}"

    @pytest.mark.django_db
    def test_matrix_grants_match_contract(self, db):
        from apps.core.management.commands.seed_dev import Command

        cmd = Command()
        perm_by_code = {p.code: p for p in cmd._seed_permissions()}
        matrix = cmd._role_perm_matrix(perm_by_code)

        org_crud = {
            "organization.view", "organization.create",
            "organization.update", "organization.delete",
            "organization.department.view", "organization.team.view",
            "organization.office.view", "person.view", "position.view",
        }
        assert org_crud <= set(matrix["org-admin"]), "org-admin lost org CRUD"
        assert org_crud <= set(matrix["platform-admin"]), "platform-admin lost org CRUD"
        for role in ("vfx-supervisor", "lead-artist", "artist"):
            assert {
                "organization.view", "organization.team.view", "person.view",
            } <= set(matrix[role]), f"{role} lost org directory views"


class TestContractFiltering:
    """search / ordering params keep working on flagship lists."""

    @pytest.mark.django_db
    def test_shot_search_and_ordering(self, staff_client, staff_user):
        from apps.organization.tests.rbac_helpers import grant_org_admin
        from apps.production.tests.factories import ProjectFactory, ShotFactory

        project = ProjectFactory.create()
        grant_org_admin(staff_user, project.organization)
        client = _scoped(staff_client, project.organization)
        ShotFactory.create(
            project=project, code="CTR_A001", organization=project.organization
        )
        ShotFactory.create(
            project=project, code="CTR_B002", organization=project.organization
        )

        found = client.get("/api/v1/shots/", {"search": "CTR_A001"}).json()["results"]
        assert [r["code"] for r in found] == ["CTR_A001"]

        ordered = client.get("/api/v1/shots/", {"ordering": "-code"}).json()["results"]
        codes = [r["code"] for r in ordered]
        assert codes == sorted(codes, reverse=True)
