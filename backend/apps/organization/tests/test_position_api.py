"""
Task A-3: Position scope + org-scoped read + person role validation.

- ``Position.scope`` distinguishes ``global_master`` (organization-agnostic
  catalog rows) from ``organization_custom`` (org-linked rows, the default).
- ``GET /api/organizations/{org.id}/positions/available/?include=all_masters``
  returns the org's own customs plus the global masters — never sibling-org
  customs.
- Person create/update accepts ``role_id`` and validates it against that
  same org-scoped catalog; the read ``role`` label is server-derived from
  the linked Position (no hardcoded/mock value).
"""

import pytest
from rest_framework import status

from apps.organization.models.position import Position
from apps.organization.tests.factories import (
    OrganizationFactory,
    PositionFactory,
)


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _grants(staff_user, org):
    from apps.organization.tests.rbac_helpers import grant_all_known_codes

    grant_all_known_codes(staff_user, organization=org)


def _master(**kwargs):
    defaults = {"code": "DIR", "name": "Director"}
    defaults.update(kwargs)
    return Position.objects.create(
        organization=None,
        scope=Position.Scope.GLOBAL_MASTER,
        **defaults,
    )


@pytest.mark.django_db
class TestPositionScopeRead:
    def test_available_returns_only_own_org_customs(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        _grants(staff_user, org)
        other = OrganizationFactory.create()
        own = PositionFactory.create(organization=org, code="ANIM", name="Animator")
        PositionFactory.create(organization=other, code="FX", name="FX Artist")

        resp = staff_client.get(
            f"/api/organizations/{org.id}/positions/available/", **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [item["id"] for item in resp.data] == [str(own.id)]
        assert resp.data[0]["scope"] == "organization_custom"
        assert resp.data[0]["organization_id"] == str(org.id)

    def test_available_include_all_masters_returns_masters_and_own_customs(
        self, staff_client, staff_user
    ):
        org = OrganizationFactory.create()
        _grants(staff_user, org)
        other = OrganizationFactory.create()
        master = _master()
        own = PositionFactory.create(organization=org, code="ANIM", name="Animator")
        PositionFactory.create(organization=other, code="FX", name="FX Artist")

        resp = staff_client.get(
            f"/api/organizations/{org.id}/positions/available/?include=all_masters",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        by_id = {item["id"]: item for item in resp.data}
        assert set(by_id) == {str(master.id), str(own.id)}
        assert by_id[str(master.id)]["scope"] == "global_master"
        assert by_id[str(master.id)]["organization_id"] is None
        assert by_id[str(own.id)]["scope"] == "organization_custom"

    def test_available_default_excludes_masters(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        _grants(staff_user, org)
        master = _master()
        own = PositionFactory.create(organization=org, code="ANIM", name="Animator")

        resp = staff_client.get(
            f"/api/organizations/{org.id}/positions/available/", **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        ids = {item["id"] for item in resp.data}
        assert str(own.id) in ids
        assert str(master.id) not in ids


@pytest.mark.django_db
class TestPersonRoleValidation:
    def test_person_create_accepts_own_org_role_id_and_derives_role(
        self, staff_client, staff_user
    ):
        org = OrganizationFactory.create()
        _grants(staff_user, org)
        position = PositionFactory.create(
            organization=org, code="ANIM", name="Animator"
        )

        resp = staff_client.post(
            f"/api/organizations/{org.id}/people/",
            data={
                "full_name": "Test Artist",
                "email": "test.artist@example.com",
                "role_id": str(position.id),
            },
            format="json",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data

        from apps.organization.models import Person

        person = Person.objects.get(name="Test Artist", organization=org)
        assert person.role_id == position.id

        detail = staff_client.get(
            f"/api/organizations/{org.id}/people/{person.id}/", **_org_header(org)
        )
        assert detail.status_code == status.HTTP_200_OK, detail.data
        assert detail.data["role"] == "Animator"

    def test_person_create_accepts_global_master_role_id(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        _grants(staff_user, org)
        master = _master()

        resp = staff_client.post(
            f"/api/organizations/{org.id}/people/",
            data={"full_name": "Master Role", "role_id": str(master.id)},
            format="json",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data

        from apps.organization.models import Person

        person = Person.objects.get(name="Master Role", organization=org)
        assert person.role_id == master.id

    def test_person_create_rejects_role_id_from_another_org(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        _grants(staff_user, org)
        other = OrganizationFactory.create()
        foreign = PositionFactory.create(
            organization=other, code="FX", name="FX Artist"
        )

        resp = staff_client.post(
            f"/api/organizations/{org.id}/people/",
            data={"full_name": "Spy", "role_id": str(foreign.id)},
            format="json",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST, resp.data
        assert "role_id" in resp.data

    def test_person_create_rejects_unknown_role_id(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        _grants(staff_user, org)

        resp = staff_client.post(
            f"/api/organizations/{org.id}/people/",
            data={
                "full_name": "Ghost",
                "role_id": "00000000-0000-0000-0000-000000000000",
            },
            format="json",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST, resp.data
        assert "role_id" in resp.data

    def test_person_update_validates_role_id(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        _grants(staff_user, org)
        other = OrganizationFactory.create()
        valid = PositionFactory.create(organization=org, code="ANIM", name="Animator")
        foreign = PositionFactory.create(
            organization=other, code="FX", name="FX Artist"
        )

        from apps.organization.tests.factories import PersonFactory

        person = PersonFactory.create(organization=org)

        ok = staff_client.patch(
            f"/api/organizations/{org.id}/people/{person.id}/",
            data={"role_id": str(valid.id)},
            format="json",
            **_org_header(org),
        )
        assert ok.status_code == status.HTTP_200_OK, ok.data

        bad = staff_client.patch(
            f"/api/organizations/{org.id}/people/{person.id}/",
            data={"role_id": str(foreign.id)},
            format="json",
            **_org_header(org),
        )
        assert bad.status_code == status.HTTP_400_BAD_REQUEST, bad.data
        assert "role_id" in bad.data

        person.refresh_from_db()
        assert person.role_id == valid.id
