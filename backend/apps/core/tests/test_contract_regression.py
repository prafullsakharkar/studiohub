"""
Cross-cutting API contract regression tests (Phase 7).

Locks the documented contract (docs/api/REAL_API.md) in place:
HTTP methods per route, response fields/types, pagination envelopes,
filter/search/ordering params, error envelopes, and the seed permission
matrix. Any intentional breaking change must update the contract docs
AND this module together — silent drift fails here first.

Domain imports are lazy (inside tests) so Core stays runtime-dependency
free; test-only imports do not create architecture dependencies.

Org-free (org-removal B6): production/masterdata endpoints are
platform-scoped — no X-Organization-ID header, no organization memberships.
Project-scoped reads are authorized via explicit ``ProjectMembership`` rows.
"""

from __future__ import annotations

import pytest


def _membership(user, project, **kwargs):
    """Attach ``user`` to ``project`` so project-scoped reads succeed."""
    from apps.production.models.project_membership import ProjectMembership

    defaults = {"role": "Artist", "scope": "PROJECT", "status": "active"}
    defaults.update(kwargs)
    return ProjectMembership.objects.create(user=user, project=project, **defaults)


class TestContractMethods:
    """Wrong HTTP methods must 405, never silently succeed or 500."""

    @pytest.mark.django_db
    def test_bulk_create_rejects_get(self, staff_client):
        resp = staff_client.get("/api/v1/shots/bulk-create/")
        assert resp.status_code == 405

    @pytest.mark.django_db
    def test_list_rejects_delete(self, staff_client):
        resp = staff_client.delete("/api/v1/shots/")
        assert resp.status_code == 405

    @pytest.mark.django_db
    def test_action_rejects_get(self, staff_client):
        from apps.production.tests.factories import ShotFactory

        shot = ShotFactory.create()
        resp = staff_client.get(
            f"/api/v1/shots/{shot.id}/approve/"
        )
        assert resp.status_code == 405

    @pytest.mark.django_db
    def test_archive_rejects_put(self, staff_client):
        from apps.production.tests.factories import ShotFactory

        shot = ShotFactory.create()
        resp = staff_client.put(
            f"/api/v1/shots/{shot.id}/archive/", {}, format="json"
        )
        assert resp.status_code == 405


class TestContractResponseShapes:
    """List/detail payloads carry the documented fields with stable types.

    Catches renamed fields and incompatible type changes.
    """

    @pytest.mark.django_db
    def test_project_list_and_detail_shape(self, staff_client, staff_user):
        from apps.production.tests.factories import ProjectFactory

        project = ProjectFactory.create()
        _membership(staff_user, project)

        item = staff_client.get("/api/v1/projects/").json()["results"][0]
        assert isinstance(item["id"], str)
        assert isinstance(item["code"], str) and item["code"]
        assert isinstance(item["name"], str) and item["name"]
        assert "status" in item

        detail = staff_client.get(f"/api/v1/projects/{project.id}/").json()
        assert detail["id"] == str(project.id)
        assert detail["code"] == project.code
        assert isinstance(detail["name"], str)

    @pytest.mark.django_db
    def test_shot_list_and_detail_shape(self, staff_client, staff_user):
        from apps.production.tests.factories import ShotFactory

        shot = ShotFactory.create()
        _membership(staff_user, shot.project)

        item = staff_client.get("/api/v1/shots/").json()["results"][0]
        assert isinstance(item["id"], str)
        assert isinstance(item["code"], str) and item["code"]
        assert isinstance(item["name"], str)
        assert "status" in item

        detail = staff_client.get(f"/api/v1/shots/{shot.id}/").json()
        assert detail["id"] == str(shot.id)
        assert detail["code"] == shot.code

    @pytest.mark.django_db
    def test_team_list_shape(self, staff_user):
        """Masterdata directory: paginated platform-global teams.

        Dispatches the masterdata viewset directly (the org app that used
        to shadow ``/api/v1/teams/`` is gone).
        """
        from rest_framework.test import APIRequestFactory, force_authenticate

        from apps.masterdata.api.viewsets.directory import TeamViewSet
        from apps.masterdata.models import Department, Team

        dept = Department.objects.create(
            code="DEPT-CT1", name="Contract Dept", department_type="creative"
        )
        team = Team.objects.create(
            code="TEAM-CT1", name="Contract Team", department=dept
        )

        view = TeamViewSet.as_view({"get": "list"})
        request = APIRequestFactory().get("/api/v1/teams/")
        force_authenticate(request, user=staff_user)
        response = view(request)

        assert response.status_code == 200
        rows = response.data
        assert {"count", "next", "previous", "results"} <= set(rows.keys())
        match = [r for r in rows["results"] if r["code"] == team.code]
        assert match, "created team missing from directory"
        assert isinstance(match[0]["name"], str)

    @pytest.mark.django_db
    def test_client_list_shape(self, staff_user):
        """Masterdata directory: platform-global clients (viewset dispatch)."""
        from rest_framework.test import APIRequestFactory, force_authenticate

        from apps.masterdata.api.viewsets.partners import ClientViewSet
        from apps.masterdata.models import Client

        client = Client.objects.create(
            code="CTCLI", name="Contract Client", status="Active"
        )

        view = ClientViewSet.as_view({"get": "list"})
        request = APIRequestFactory().get("/api/v1/clients/")
        force_authenticate(request, user=staff_user)
        response = view(request)

        assert response.status_code == 200
        rows = response.data
        assert {"count", "next", "previous", "results"} <= set(rows.keys())
        match = [r for r in rows["results"] if r["code"] == client.code]
        assert match, "created client missing from directory"
        assert match[0]["code"] == client.code
        assert isinstance(match[0]["name"], str)


class TestContractEnvelopes:
    """Paginated vs bare-array envelope matrix (docs/api/REAL_API.md)."""

    @pytest.mark.django_db
    def test_paginated_envelope(self, staff_client, staff_user):
        from apps.production.tests.factories import ProjectFactory

        project = ProjectFactory.create()
        _membership(staff_user, project)
        data = staff_client.get("/api/v1/projects/").json()
        assert {"count", "next", "previous", "results"} <= set(data.keys())
        assert isinstance(data["results"], list)

    @pytest.mark.django_db
    def test_bare_array_envelopes(self, staff_client):
        media = staff_client.get("/api/v1/media/").json()
        assert isinstance(media, list)

        attachments = staff_client.get("/api/v1/attachments/").json()
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

        resp = staff_client.get(f"/api/v1/shots/{uuid4()}/")
        assert resp.status_code == 404
        assert "detail" in resp.json()

    @pytest.mark.django_db
    def test_invalid_create_is_400_with_field_errors(self, staff_client):
        resp = staff_client.post(
            "/api/v1/shots/", {}, format="json"
        )
        assert resp.status_code == 400
        body = resp.json()
        assert isinstance(body, dict) and body, "expected field-error mapping"
        assert any(isinstance(v, list) for v in body.values())

    @pytest.mark.django_db
    def test_cross_org_nested_denied_without_leak(self, db):
        """The org API trees are gone: nested org routes 404 by absence."""
        from rest_framework.test import APIClient

        from apps.identity.tests.factories import UserFactory

        outsider = UserFactory.create()
        client = APIClient()
        client.force_authenticate(user=outsider)

        resp = client.get("/api/organizations/00000000-0000-0000-0000-000000000000/teams/")
        assert resp.status_code == 404


class TestContractPermissionMatrix:
    """The seed permission matrix must cover every enforced permission code.

    Phase 6 found zero roles held any organization-domain code, locking every
    non-superuser out of the org API. This test fails if enforcement and the
    seed catalog drift apart again. Org-free (B6): enforced codes come from
    the platform RBAC, masterdata directory, and production viewsets.
    """

    def _enforced_codes(self):
        from apps.identity.api.viewsets.rbac import (
            GroupViewSet,
            PermissionViewSet,
            RoleViewSet,
        )
        from apps.masterdata.api.viewsets import lookup
        from apps.masterdata.api.viewsets.directory import (
            DepartmentViewSet,
            OfficeViewSet,
            PersonViewSet,
            PositionViewSet,
            TeamViewSet,
        )
        from apps.masterdata.api.viewsets.partners import ClientViewSet, VendorViewSet
        from apps.production.api.viewsets import asset, project, shot, task

        viewsets = [
            lookup.MasterStatusViewSet,
            lookup.MasterTaskTypeViewSet,
            lookup.MasterAssetTypeViewSet,
            lookup.MasterShotTypeViewSet,
            lookup.MasterReviewTypeViewSet,
            lookup.MasterFileTypeViewSet,
            project.ProjectViewSet,
            shot.ShotViewSet,
            asset.AssetViewSet,
            task.TaskViewSet,
            DepartmentViewSet,
            TeamViewSet,
            OfficeViewSet,
            PositionViewSet,
            PersonViewSet,
            ClientViewSet,
            VendorViewSet,
            RoleViewSet,
            GroupViewSet,
            PermissionViewSet,
        ]
        codes = set()
        for viewset in viewsets:
            for action_codes in getattr(viewset, "permission_map", {}).values():
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

        # Phase 8: the legacy platform.master_data.* grants are replaced by the explicit
        # masterdata codes (DECISIONS D9, Option B). Nothing may grant the old ones any more.
        platform_dir = {
            "masterdata.directory.manage",
            "masterdata.catalog.manage",
            "masterdata.person.view_sensitive",
            "masterdata.client.view_financial",
            "identity.user.view",
        }
        assert platform_dir <= set(matrix["org-admin"]), "org-admin lost platform directory grants"
        retired = {"platform.master_data.configure", "platform.master_data.create"}
        assert not retired & set(perm_by_code), "a retired code is still in the permission catalog"
        for role, codes in matrix.items():
            assert not retired & set(codes), f"{role} still grants a retired masterdata code"
        assert set(perm_by_code) <= set(matrix["platform-admin"]), "platform-admin lost full catalog"
        for role in ("vfx-supervisor", "lead-artist", "artist"):
            assert "identity.user.view" in matrix[role], f"{role} lost directory view"

        # org-admin is a legacy org-era role: it must NOT carry ADMIN priority
        # or it would match the platform-admin visibility check in the
        # production selectors (_has_global_admin_role).
        from apps.core.management.commands.init_platform import ROLE_SPECS
        from apps.identity.choices.rbac import RolePriority

        org_admin = next(s for s in ROLE_SPECS if s["code"] == "org-admin")
        assert org_admin["priority"] > RolePriority.ADMIN, (
            "org-admin must stay below ADMIN priority (no platform-wide visibility)"
        )


class TestContractFiltering:
    """search / ordering params keep working on flagship lists."""

    @pytest.mark.django_db
    def test_shot_search_and_ordering(self, staff_client, staff_user):
        from apps.production.tests.factories import ProjectFactory, ShotFactory

        project = ProjectFactory.create()
        _membership(staff_user, project)
        ShotFactory.create(
            project=project, code="CTR_A001"
        )
        ShotFactory.create(
            project=project, code="CTR_B002"
        )

        found = staff_client.get("/api/v1/shots/", {"search": "CTR_A001"}).json()["results"]
        assert [r["code"] for r in found] == ["CTR_A001"]

        ordered = staff_client.get("/api/v1/shots/", {"ordering": "-code"}).json()["results"]
        codes = [r["code"] for r in ordered]
        assert codes == sorted(codes, reverse=True)
