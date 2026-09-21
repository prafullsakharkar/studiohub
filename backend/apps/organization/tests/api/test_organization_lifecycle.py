"""
End-to-end lifecycle tests for the Organization API.

Chains the real transitions the implementation supports (there is no
dedicated unarchive endpoint — unarchive is PATCH status):

    CREATE → ACTIVE → UPDATE → ARCHIVE → UNARCHIVE → SOFT DELETE
        → RESTORE → UPDATE → DELETE

plus the invalid transitions the architecture must reject.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.organization.models import Organization
from apps.organization.tests.factories import OrganizationFactory


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _list_url():
    return reverse("api:v1:organization:organization-list")


def _detail_url(org):
    return reverse(
        "api:v1:organization:organization-detail",
        kwargs={"uuid": org.uuid},
    )


def _action_url(org, action):
    return reverse(
        f"api:v1:organization:organization-{action}",
        kwargs={"uuid": org.uuid},
    )


def _visible_ids(client, org):
    response = client.get(_list_url(), **_org_header(org))
    assert response.status_code == 200
    return [row["id"] for row in response.data["results"]]


@pytest.mark.django_db
class TestOrganizationLifecycle:
    def test_full_lifecycle(self, staff_client):
        # CREATE → ACTIVE
        response = staff_client.post(
            _list_url(),
            {
                "code": "LIFE1",
                "name": "Lifecycle Org",
                "organization_type": "studio",
                "status": "Active",
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        org = Organization.objects.get(code="LIFE1")
        assert org.status == "active"
        assert org.is_deleted is False
        assert str(org.id) in _visible_ids(staff_client, org)

        # UPDATE
        response = staff_client.patch(
            _detail_url(org), {"name": "Lifecycle Org v2"}, format="json"
        )
        assert response.status_code == 200
        org.refresh_from_db()
        assert org.name == "Lifecycle Org v2"
        updated_at_1 = org.updated_at

        # ARCHIVE (POST action)
        response = staff_client.post(_action_url(org, "archive"), **_org_header(org))
        assert response.status_code == 200
        org.refresh_from_db()
        assert org.status == "archived"
        assert Organization.objects.filter(pk=org.pk).exists()

        # UNARCHIVE (PATCH status — no dedicated endpoint exists)
        response = staff_client.patch(
            _detail_url(org), {"status": "Active"}, format="json"
        )
        assert response.status_code == 200
        org.refresh_from_db()
        assert org.status == "active"

        # SOFT DELETE
        response = staff_client.delete(_detail_url(org))
        assert response.status_code == 204
        org.refresh_from_db()
        assert org.is_deleted is True
        assert org.deleted_at is not None
        # Row persists but leaves the live API surface.
        assert Organization.all_objects.filter(pk=org.pk).exists()
        assert str(org.id) not in _visible_ids(staff_client, org)
        assert staff_client.get(_detail_url(org)).status_code == 404

        # RESTORE
        response = staff_client.post(_action_url(org, "restore"), **_org_header(org))
        assert response.status_code == 200
        org.refresh_from_db()
        assert org.is_deleted is False
        assert org.deleted_at is None
        assert str(org.id) in _visible_ids(staff_client, org)

        # UPDATE after restore works normally.
        response = staff_client.patch(
            _detail_url(org), {"name": "Lifecycle Org v3"}, format="json"
        )
        assert response.status_code == 200
        org.refresh_from_db()
        assert org.name == "Lifecycle Org v3"
        assert org.updated_at >= updated_at_1

        # DELETE again (repeated delete of a live row is fine).
        assert staff_client.delete(_detail_url(org)).status_code == 204
        org.refresh_from_db()
        assert org.is_deleted is True

    def test_invalid_transitions(self, staff_client):
        org = OrganizationFactory.create(status="active")

        # Active → Restore: nothing deleted (404, client/vendor precedent).
        assert (
            staff_client.post(_action_url(org, "restore"), **_org_header(org)).status_code
            == 404
        )

        # Soft-deleted rows leave the live surface entirely.
        org.delete()
        assert staff_client.get(_detail_url(org)).status_code == 404
        assert staff_client.delete(_detail_url(org)).status_code == 404
        assert (
            staff_client.post(_action_url(org, "archive"), **_org_header(org)).status_code
            == 404
        )
        assert (
            staff_client.patch(
                _detail_url(org), {"name": "Ghost"}, format="json"
            ).status_code
            == 404
        )
        # …except restore, which is the way back.
        assert (
            staff_client.post(_action_url(org, "restore"), **_org_header(org)).status_code
            == 200
        )
        org.refresh_from_db()
        assert org.is_deleted is False
