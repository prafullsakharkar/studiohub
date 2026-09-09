"""
Frontend-contract tests for organization compat routes (studiohub-react parity).

- Nested /api/organizations/<org>/<resource>/ (slash-optional).
- Flat /api/v1/<resource>/ bare-array fallbacks.
- Frontend status-word mapping (invitations, api-keys).
- Auth membership endpoints.
- Project-scoped nested API (summary/members/lists/notes/derived objects).
"""

import pytest
from rest_framework import status

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    APIKeyFactory,
    ClientFactory,
    DepartmentFactory,
    InvitationFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    PositionFactory,
)
from apps.production.models import EditorialCut
from apps.production.tests.factories import (
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    TaskFactory,
)


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _membered_client(org):
    """Staff client whose user holds a membership in org (scope gates).

    Several selectors (invitations, api-keys, project scope) restrict rows
    to the user's organizations even for staff, so tests need the membership.
    """
    from rest_framework.test import APIClient

    user = UserFactory.create(is_staff=True)
    OrganizationMembershipFactory.create(user=user, organization=org)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.mark.django_db
class TestNestedOrganizationRoutes:
    def test_nested_clients_paginated(self, staff_client):
        org = OrganizationFactory.create()
        ClientFactory.create(organization=org, name="Acme")
        resp = staff_client.get(
            f"/api/organizations/{org.id}/clients/", **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert set(("count", "results")) <= set(resp.data.keys())

    def test_nested_departments_bare_array_slashless(self, staff_client):
        org = OrganizationFactory.create()
        DepartmentFactory.create(organization=org, name="FX")
        resp = staff_client.get(
            f"/api/organizations/{org.id}/departments", **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert isinstance(resp.data, list)
        assert resp.data[0]["name"] == "FX"

    def test_nested_org_accepts_code(self, staff_client):
        org = OrganizationFactory.create()
        DepartmentFactory.create(organization=org, name="Comp")
        resp = staff_client.get(
            f"/api/organizations/{org.code}/departments/", **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert isinstance(resp.data, list)

    def test_nested_unknown_org_404(self, staff_client):
        resp = staff_client.get("/api/organizations/nope/departments/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_nested_positions_flat_and_nested(self, staff_client):
        org = OrganizationFactory.create()
        PositionFactory.create(organization=org)
        flat = staff_client.get("/api/v1/positions/", **_org_header(org))
        assert flat.status_code == status.HTTP_200_OK, flat.data
        assert isinstance(flat.data, list)
        nested = staff_client.get(
            f"/api/organizations/{org.id}/positions/", **_org_header(org)
        )
        assert nested.status_code == status.HTTP_200_OK, nested.data
        assert isinstance(nested.data, list)
        assert len(nested.data) == len(flat.data) == 1


@pytest.mark.django_db
class TestCompatStatusMapping:
    def _setup(self):
        org = OrganizationFactory.create()
        client, _ = _membered_client(org)
        return org, client

    def test_invitation_revoke_maps_to_cancelled(self):
        org, client = self._setup()
        invite = InvitationFactory.create(organization=org)
        resp = client.patch(
            f"/api/v1/invitations/{invite.id}/",
            data={"status": "Revoked"},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        invite.refresh_from_db()
        assert invite.status == "cancelled"

    def test_invitation_list_outputs_frontend_words(self):
        org, client = self._setup()
        InvitationFactory.create(organization=org)
        resp = client.get("/api/v1/invitations/", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data[0]["status"] == "Pending"

    def test_api_key_revoke_maps_to_is_active(self):
        org, client = self._setup()
        key = APIKeyFactory.create(organization=org)
        resp = client.patch(
            f"/api/v1/api-keys/{key.id}/",
            data={"status": "Revoked"},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        key.refresh_from_db()
        assert key.is_active is False
        assert resp.data["status"] == "Revoked"


@pytest.mark.django_db
class TestAuthMemberships:
    def test_auth_memberships_lists_user_orgs(self, staff_client):
        user = UserFactory.create()
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org)
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.get("/api/v1/auth/memberships/")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert len(resp.data) == 1
        row = resp.data[0]
        assert row["user_id"] == str(user.id)
        assert row["organization_id"] == str(org.id)
        assert row["organization_name"] == org.name
        assert row["status"] == "Active"

    def test_users_me_memberships_alias(self):
        user = UserFactory.create()
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org)
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.get("/api/v1/users/me/memberships/")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert len(resp.data) == 1

    def test_memberships_require_auth(self):
        from rest_framework.test import APIClient

        resp = APIClient().get("/api/v1/auth/memberships/")
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestProjectScopedAPI:
    def _setup(self):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        client, _ = _membered_client(org)
        return org, project, client

    def _url(self, org, project, sub):
        return f"/api/organizations/{org.id}/projects/{project.id}/{sub}"

    def test_summary(self):
        org, project, client = self._setup()
        SequenceFactory.create(organization=org, project=project, code="PS1")
        ShotFactory.create(organization=org, project=project, code="PH1")
        resp = client.get(self._url(org, project, "summary"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["project"]["id"] == str(project.id)
        assert resp.data["counts"]["sequences"] == 1
        assert resp.data["counts"]["shots"] == 1
        assert resp.data["organization_id"] == str(org.id)
        assert resp.data["project_id"] == str(project.id)

    def test_summary_accepts_codes(self):
        org, project, client = self._setup()
        resp = client.get(
            f"/api/organizations/{org.code}/projects/{project.code}/summary",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data

    def test_summary_unknown_project_404(self):
        org, project, client = self._setup()
        resp = client.get(
            f"/api/organizations/{org.id}/projects/nope/summary", **_org_header(org)
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_members_crud(self):
        org, project, client = self._setup()
        newcomer = UserFactory.create()
        resp = client.post(
            self._url(org, project, "members"),
            data={"email": newcomer.email, "role": "Artist"},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert resp.data["user_id"] == str(newcomer.id)
        assert resp.data["project_id"] == str(project.id)
        assert resp.data["role"] == "Artist"
        assert resp.data["roles"] == ["Artist"]
        resp = client.get(self._url(org, project, "members"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["email"] == newcomer.email

    def test_members_unknown_user_404(self):
        org, project, client = self._setup()
        resp = client.post(
            self._url(org, project, "members"),
            data={"email": "ghost@example.com"},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_entity_lists_are_paginated_and_scoped(self):
        org, project, client = self._setup()
        other = ProjectFactory.create(organization=org)
        SequenceFactory.create(organization=org, project=project, code="IN1")
        SequenceFactory.create(organization=org, project=other, code="OUT1")
        TaskFactory.create(organization=org, project=project, code="T-IN1")
        resp = client.get(
            self._url(org, project, "sequences"), **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["code"] == "IN1"
        resp = client.get(self._url(org, project, "tasks"), **_org_header(org))
        assert resp.data["count"] == 1

    def test_notes_list_and_create(self):
        org, project, client = self._setup()
        resp = client.post(
            self._url(org, project, "notes"),
            data={"subject": "Note One", "body": "Hello", "category": "General"},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert resp.data["subject"] == "Note One"
        assert resp.data["project_id"] == str(project.id)
        resp = client.get(self._url(org, project, "notes"), **_org_header(org))
        assert resp.data["count"] == 1

    def test_editorial_list(self):
        org, project, client = self._setup()
        EditorialCut.objects.create(
            organization=org, project=project, code="CUT1", name="Cut One"
        )
        resp = client.get(self._url(org, project, "editorial"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["project_code"] == project.code

    def test_schedule_resources_pipeline(self):
        org, project, client = self._setup()
        resp = client.get(self._url(org, project, "schedule"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert len(resp.data["milestones"]) == 5
        assert resp.data["project_id"] == str(project.id)
        resp = client.get(self._url(org, project, "resources"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["total_artists"] == 0
        assert isinstance(resp.data["departments"], list)
        resp = client.get(self._url(org, project, "pipeline"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert len(resp.data["dcc_integrations"]) == 4
        assert resp.data["usd_schema_version"] == "23.11"

    def test_files_and_activity(self):
        org, project, client = self._setup()
        resp = client.get(self._url(org, project, "files"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert "results" in resp.data
        resp = client.get(self._url(org, project, "activity"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert "results" in resp.data

    def test_deliveries_nested(self):
        from apps.deliveries.models import DeliveryPackage

        org, project, client = self._setup()
        DeliveryPackage.objects.create(
            organization=org, project=project, code="DLV1", name="Delivery One"
        )
        resp = client.get(self._url(org, project, "deliveries"), **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1

    def test_non_member_forbidden(self):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        outsider = UserFactory.create()
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=outsider)
        resp = client.get(
            f"/api/organizations/{org.id}/projects/{project.id}/summary",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_org_isolation(self):
        org_a, project_a, client_a = self._setup()
        org_b = OrganizationFactory.create()
        project_b = ProjectFactory.create(organization=org_b)
        SequenceFactory.create(organization=org_b, project=project_b, code="B1")
        # project_b is invisible through org_a's scope
        resp = client_a.get(
            f"/api/organizations/{org_a.id}/projects/{project_b.id}/summary",
            **_org_header(org_a),
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        # and org_b data never leaks into org_a's project list
        resp = client_a.get(
            f"/api/organizations/{org_a.id}/projects/{project_a.id}/sequences",
            **_org_header(org_a),
        )
        assert resp.data["count"] == 0


@pytest.mark.django_db
class TestOrganizationContractFields:
    """Frontend Organization type parity (types/organization.ts).

    Regression: OrganizationSwitcher crashed on
    ``currentOrganization.headquarters.split`` because the list payload
    omitted headquarters/tier/logo_url/counts. Every field the switcher
    and overview tabs read must be present with crash-safe types.
    """

    def test_list_carries_switcher_contract(self, staff_client):
        org = OrganizationFactory.create(
            headquarters="Montreal, QC, Canada",
            primary_contact_name="Alex Chen",
        )
        resp = staff_client.get("/api/v1/organizations/", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        row = resp.data[0] if isinstance(resp.data, list) else resp.data["results"][0]
        assert row["headquarters"] == "Montreal, QC, Canada"
        assert isinstance(row["tier"], str)
        assert isinstance(row["logo_url"], str)
        assert isinstance(row["crew_count"], int)
        assert isinstance(row["offices_count"], int)
        assert isinstance(row["active_projects_count"], int)
        assert isinstance(row["storage_quota_tb"], (int, float))
        assert isinstance(row["storage_used_tb"], (int, float))
        assert row["primary_contact_name"] == "Alex Chen"
        assert row["primary_contact_email"] == org.email
        # Crash-path expressions from OrganizationSwitcher must evaluate.
        assert row["headquarters"].split(",")[0] == "Montreal"
        assert isinstance(row["tier"].replace("Enterprise ", ""), str)

    def test_detail_carries_contract(self, staff_client):
        org = OrganizationFactory.create(headquarters="London, United Kingdom")
        resp = staff_client.get(
            f"/api/v1/organizations/{org.id}/", **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["headquarters"] == "London, United Kingdom"
        assert isinstance(resp.data["tier"], str)
        assert isinstance(resp.data["crew_count"], int)
