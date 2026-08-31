"""
Organization -> Project dependency tests.

Verifies that Projects are owned by and scoped to an Organization:
  * create auto-assigns the active organization (from the X-Organization header);
  * organization is read-only and cannot be changed via update;
  * listing is scoped to the active organization (cross-tenant isolation);
  * switching the active organization changes the returned set.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import OrganizationFactory
from apps.production.tests.factories import ProjectFactory


@pytest.mark.django_db
class TestProjectOrganizationScoping:
    def _list_url(self):
        return reverse("api:v1:production:project-list")

    def _detail_url(self, project):
        return reverse("api:v1:production:project-detail", args=[project.id])

    def test_create_auto_assigns_organization_from_header(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.post(
            self._list_url(),
            data={"code": "PROJX01", "name": "Org Scoped Project"},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        from apps.production.models import Project

        project = Project.objects.get(code="PROJX01")
        assert project.organization_id == org.id

    def test_create_falls_back_to_user_membership_org(self, staff_user, staff_client):
        """Without a header, the create path uses the user's membership org."""
        from apps.organization.tests.factories import OrganizationMembershipFactory

        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(organization=org, user=staff_user)
        resp = staff_client.post(
            self._list_url(),
            data={"code": "PROJX02", "name": "Membership Org Project"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        from apps.production.models import Project

        project = Project.objects.get(code="PROJX02")
        assert project.organization_id == org.id

    def test_update_cannot_change_organization(self, staff_client):
        org = OrganizationFactory.create()
        other_org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org, code="PROJX03")
        resp = staff_client.patch(
            self._detail_url(project),
            data={"organization": str(other_org.id), "name": "Renamed"},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        project.refresh_from_db()
        assert project.organization_id == org.id
        assert project.name == "Renamed"

    def test_list_is_scoped_to_organization_header(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        ProjectFactory.create(organization=org_a, code="ORGAA01")
        ProjectFactory.create(organization=org_b, code="ORGBB01")
        resp = staff_client.get(self._list_url(), HTTP_X_ORGANIZATION_ID=str(org_a.id))
        assert resp.status_code == status.HTTP_200_OK
        codes = {p["code"] for p in resp.data["results"]}
        assert "ORGAA01" in codes
        assert "ORGBB01" not in codes

    def test_switching_organization_header_changes_results(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        ProjectFactory.create(organization=org_a, code="ORGAA02")
        ProjectFactory.create(organization=org_b, code="ORGBB02")
        list_url = self._list_url()
        resp_b = staff_client.get(list_url, HTTP_X_ORGANIZATION_ID=str(org_b.id))
        assert resp_b.status_code == status.HTTP_200_OK
        codes_b = {p["code"] for p in resp_b.data["results"]}
        assert "ORGBB02" in codes_b
        assert "ORGAA02" not in codes_b

    def test_detail_is_scoped_to_organization(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        project_a = ProjectFactory.create(organization=org_a, code="ORGAA03")
        resp = staff_client.get(
            self._detail_url(project_a),
            HTTP_X_ORGANIZATION_ID=str(org_b.id),
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND
