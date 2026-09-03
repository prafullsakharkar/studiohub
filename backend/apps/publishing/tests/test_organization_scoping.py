"""
Organization isolation tests for the publishing API.

Verifies fail-closed organization scoping:
  * create auto-assigns the active organization (from the X-Organization header);
  * listing is scoped to the active organization (cross-tenant isolation);
  * switching the active organization changes the returned set;
  * detail access to another organization's publish returns 404;
  * no organization context resolves to empty results / rejected writes.
"""
import uuid

import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import OrganizationFactory
from apps.publishing.models import PublishItem


def _create_payload(code, **overrides):
    payload = {
        "name": "Org Scoped Publish",
        "code": code,
        "entity_type": "Shot",
        "entity_id": f"shot-{code}",
        "entity_code": "SH001",
        "entity_name": "Test Shot",
        "dcc_tool": "Nuke",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
class TestPublishingOrganizationScoping:
    def _list_url(self):
        return reverse("api:v1:publishing:publishing-list")

    def _detail_url(self, publish):
        return reverse(
            "api:v1:publishing:publishing-detail",
            kwargs={"uuid": str(publish.id)},
        )

    def test_create_auto_assigns_organization_from_header(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.post(
            self._list_url(),
            data=_create_payload("PUB-ORG-01"),
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        publish = PublishItem.objects.get(code="PUB-ORG-01")
        assert publish.organization_id == org.id

    def test_list_is_scoped_to_organization_header(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        PublishItem.objects.create(
            name="A",
            code="PUB-ORG-AA",
            entity_type="Shot",
            entity_id="shot-a",
            entity_code="SHA",
            entity_name="Shot A",
            dcc_tool="Nuke",
            organization=org_a,
        )
        PublishItem.objects.create(
            name="B",
            code="PUB-ORG-BB",
            entity_type="Shot",
            entity_id="shot-b",
            entity_code="SHB",
            entity_name="Shot B",
            dcc_tool="Nuke",
            organization=org_b,
        )
        resp = staff_client.get(
            self._list_url(), HTTP_X_ORGANIZATION_ID=str(org_a.id)
        )
        assert resp.status_code == status.HTTP_200_OK
        codes = {p["code"] for p in resp.data["results"]}
        assert "PUB-ORG-AA" in codes
        assert "PUB-ORG-BB" not in codes

    def test_switching_organization_header_changes_results(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        PublishItem.objects.create(
            name="A",
            code="PUB-ORG-AA2",
            entity_type="Shot",
            entity_id="shot-a2",
            entity_code="SHA",
            entity_name="Shot A",
            dcc_tool="Nuke",
            organization=org_a,
        )
        PublishItem.objects.create(
            name="B",
            code="PUB-ORG-BB2",
            entity_type="Shot",
            entity_id="shot-b2",
            entity_code="SHB",
            entity_name="Shot B",
            dcc_tool="Nuke",
            organization=org_b,
        )
        resp_b = staff_client.get(
            self._list_url(), HTTP_X_ORGANIZATION_ID=str(org_b.id)
        )
        assert resp_b.status_code == status.HTTP_200_OK
        codes_b = {p["code"] for p in resp_b.data["results"]}
        assert "PUB-ORG-BB2" in codes_b
        assert "PUB-ORG-AA2" not in codes_b

    def test_detail_is_scoped_to_organization(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        publish = PublishItem.objects.create(
            name="A",
            code="PUB-ORG-AA3",
            entity_type="Shot",
            entity_id="shot-a3",
            entity_code="SHA",
            entity_name="Shot A",
            dcc_tool="Nuke",
            organization=org_a,
        )
        resp = staff_client.get(
            self._detail_url(publish),
            HTTP_X_ORGANIZATION_ID=str(org_b.id),
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_list_without_org_context_fails_closed(self, staff_client):
        """No org header must not leak every organization's publishes."""
        PublishItem.objects.create(
            name="A",
            code="PUB-ORG-AA4",
            entity_type="Shot",
            entity_id="shot-a4",
            entity_code="SHA",
            entity_name="Shot A",
            dcc_tool="Nuke",
            organization=OrganizationFactory.create(),
        )
        resp = staff_client.get(self._list_url())
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"] == []

    def test_list_with_unknown_org_id_does_not_leak(self, staff_client):
        """An unresolvable org id must not fall back to all publishes."""
        PublishItem.objects.create(
            name="A",
            code="PUB-ORG-AA5",
            entity_type="Shot",
            entity_id="shot-a5",
            entity_code="SHA",
            entity_name="Shot A",
            dcc_tool="Nuke",
            organization=OrganizationFactory.create(),
        )
        resp = staff_client.get(
            self._list_url(),
            HTTP_X_ORGANIZATION_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"] == []

    def test_create_without_org_context_fails_closed(self, staff_client):
        """Create must not assign to an arbitrary/first organization."""
        resp = staff_client.post(
            self._list_url(),
            data=_create_payload("PUB-ORG-99"),
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert not PublishItem.objects.filter(code="PUB-ORG-99").exists()


@pytest.mark.django_db
class TestValidationRuleOrganizationScoping:
    def test_validation_rules_are_scoped_to_organization(self, staff_client):
        """Validation must only apply rules of the active organization."""
        from apps.publishing.models import PublishValidationRule

        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        publish = PublishItem.objects.create(
            name="A",
            code="PUB-RULE-AA",
            entity_type="Shot",
            entity_id="shot-rule",
            entity_code="SHA",
            entity_name="Shot A",
            dcc_tool="Nuke",
            organization=org_a,
        )
        PublishValidationRule.objects.create(
            organization=org_a,
            name="Org A rule",
            rule_type=PublishValidationRule.RULE_METADATA,
        )
        PublishValidationRule.objects.create(
            organization=org_b,
            name="Org B rule",
            rule_type=PublishValidationRule.RULE_METADATA,
        )

        url = reverse(
            "api:v1:publishing:publishing-validate",
            kwargs={"uuid": str(publish.id)},
        )
        resp = staff_client.post(
            url, HTTP_X_ORGANIZATION_ID=str(org_a.id)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        rule_names = {
            r["rule_name"] for r in resp.data["validation_results"]
        }
        assert "Org A rule" in rule_names
        assert "Org B rule" not in rule_names
