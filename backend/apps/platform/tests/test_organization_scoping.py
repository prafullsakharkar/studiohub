"""
Organization isolation tests for the platform API.

Verifies fail-closed organization scoping:
  * listing is scoped to the active organization (cross-tenant isolation);
  * switching the active organization changes the returned set;
  * detail access to another organization's record returns 404;
  * no organization context resolves to empty results.
"""
import uuid

import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import OrganizationFactory
from apps.platform.models import ProductionReport, StudioNotification


def _notif_url(**kwargs):
    return reverse("api:v1:platform:notification-list", kwargs=kwargs)


def _notif_detail(notif):
    return reverse(
        "api:v1:platform:notification-detail", kwargs={"uuid": str(notif.id)}
    )


def _report_url(**kwargs):
    return reverse("api:v1:platform:report-list", kwargs=kwargs)


@pytest.mark.django_db
class TestNotificationOrganizationScoping:
    def test_list_is_scoped_to_organization_header(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        StudioNotification.objects.create(
            title="A", type="info", organization=org_a
        )
        StudioNotification.objects.create(
            title="B", type="info", organization=org_b
        )
        resp = staff_client.get(
            _notif_url(), HTTP_X_ORGANIZATION_ID=str(org_a.id)
        )
        assert resp.status_code == status.HTTP_200_OK
        titles = {n["title"] for n in resp.data}
        assert "A" in titles
        assert "B" not in titles

    def test_switching_organization_header_changes_results(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        StudioNotification.objects.create(
            title="A2", type="info", organization=org_a
        )
        StudioNotification.objects.create(
            title="B2", type="info", organization=org_b
        )
        resp = staff_client.get(
            _notif_url(), HTTP_X_ORGANIZATION_ID=str(org_b.id)
        )
        titles = {n["title"] for n in resp.data}
        assert "B2" in titles
        assert "A2" not in titles

    def test_detail_is_scoped_to_organization(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        notif = StudioNotification.objects.create(
            title="A", type="info", organization=org_a
        )
        resp = staff_client.get(
            _notif_detail(notif), HTTP_X_ORGANIZATION_ID=str(org_b.id)
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_list_without_org_context_fails_closed(self, staff_client):
        StudioNotification.objects.create(
            title="A", type="info", organization=OrganizationFactory.create()
        )
        resp = staff_client.get(_notif_url())
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == []

    def test_list_with_unknown_org_id_does_not_leak(self, staff_client):
        StudioNotification.objects.create(
            title="A", type="info", organization=OrganizationFactory.create()
        )
        resp = staff_client.get(
            _notif_url(), HTTP_X_ORGANIZATION_ID=str(uuid.uuid4())
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == []


@pytest.mark.django_db
class TestReportOrganizationScoping:
    def test_list_is_scoped_to_organization_header(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        ProductionReport.objects.create(
            title="R A", category="Production", organization=org_a
        )
        ProductionReport.objects.create(
            title="R B", category="Production", organization=org_b
        )
        resp = staff_client.get(
            _report_url(), HTTP_X_ORGANIZATION_ID=str(org_a.id)
        )
        assert resp.status_code == status.HTTP_200_OK
        titles = {r["title"] for r in resp.data}
        assert "R A" in titles
        assert "R B" not in titles

    def test_list_without_org_context_fails_closed(self, staff_client):
        ProductionReport.objects.create(
            title="R A",
            category="Production",
            organization=OrganizationFactory.create(),
        )
        resp = staff_client.get(_report_url())
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == []
