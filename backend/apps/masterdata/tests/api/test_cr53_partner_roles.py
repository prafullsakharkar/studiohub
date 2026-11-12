"""
CR-53: who reads clients, vendors and their contracts, with the real seeded roles.

``masterdata.partner.view`` is held by platform-admin, org-admin, production-admin and
vfx-supervisor; leads, artists and org members get 403 on every partner route. The money stays
with ``masterdata.client.view_financial`` (production-admin, org-admin), and the client's name on a
project or a delivery is read from that record, not from the client route.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.identity.models import Role, UserRole
from apps.identity.tests.factories import UserFactory
from apps.masterdata.tests.factories import (
    ClientContractFactory,
    ClientFactory,
    VendorContractFactory,
    VendorFactory,
)
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"
READERS = ("platform-admin", "org-admin", "production-admin", "vfx-supervisor")
REFUSED = ("lead-artist", "artist", "org-member")
ROUTES = ("clients", "vendors", "client-contracts", "vendor-contracts")


@pytest.fixture(autouse=True)
def seeded(seeded_platform_module):
    """The real role matrix from ``init_platform`` (conftest.py)."""


@pytest.fixture
def rows():
    acme = ClientFactory.create(code="ACME53", name="Acme Pictures", total_billed_usd=Decimal("10"))
    nlr = VendorFactory.create(code="NLR53", name="Northern Light")
    return {
        "clients": acme,
        "vendors": nlr,
        "client-contracts": ClientContractFactory.create(client=acme, value_usd=Decimal("480")),
        "vendor-contracts": VendorContractFactory.create(vendor=nlr, total_value_usd=Decimal("90")),
    }


def as_role(role_code: str, project=None) -> APIClient:
    user = UserFactory.create()
    UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
    if project is not None:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=user)
    return api


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize("role", READERS)
def test_the_reading_roles_list_and_open_every_partner_record(rows, role, route):
    api = as_role(role)

    assert api.get(f"{API}/{route}/").status_code == 200
    assert api.get(f"{API}/{route}/{rows[route].pk}/").status_code == 200


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize("role", REFUSED)
def test_leads_artists_and_members_are_refused_before_any_lookup(rows, role, route):
    api = as_role(role)

    assert api.get(f"{API}/{route}/").status_code == 403
    assert api.get(f"{API}/{route}/{rows[route].pk}/").status_code == 403
    # A missing id answers like a forbidden one: nothing is learned from the status.
    assert api.get(f"{API}/{route}/{uuid.uuid4()}/").status_code == 403


def test_a_supervisor_reads_contracts_without_their_values(rows):
    api = as_role("vfx-supervisor")

    client_contract = api.get(f"{API}/client-contracts/{rows['client-contracts'].pk}/").json()
    vendor_contract = api.get(f"{API}/vendor-contracts/{rows['vendor-contracts'].pk}/").json()
    client = api.get(f"{API}/clients/{rows['clients'].pk}/").json()

    assert client_contract["contract_number"] == rows["client-contracts"].contract_number
    assert "value_usd" not in client_contract
    assert "total_value_usd" not in vendor_contract
    assert "total_billed_usd" not in client


def test_a_producer_reads_the_values(rows):
    api = as_role("production-admin")

    body = api.get(f"{API}/client-contracts/{rows['client-contracts'].pk}/").json()

    assert Decimal(str(body["value_usd"])) == Decimal("480")


def test_an_artist_still_reads_the_client_name_of_their_project(rows):
    acme = rows["clients"]
    project = ProjectFactory.create(code="CR53P", client_id=str(acme.pk), client_name=acme.name)
    api = as_role("artist", project)

    body = api.get(f"{API}/projects/{project.pk}/").json()

    assert body["client_name"] == "Acme Pictures"


def test_a_producer_still_creates_a_delivery_for_a_client_and_a_lead_reads_its_name(rows):
    acme = rows["clients"]
    project = ProjectFactory.create(code="CR53D")
    producer = as_role("production-admin", project)

    created = producer.post(
        f"{API}/deliveries/",
        {"name": "Turnover", "project_id": str(project.pk), "client_id": str(acme.pk)},
        format="json",
    )
    assert created.status_code == 201, created.content

    lead = as_role("lead-artist", project)
    [row] = lead.get(f"{API}/deliveries/?project={project.pk}").json()["results"]
    assert row["client_name"] == "Acme Pictures"
    assert lead.get(f"{API}/clients/{acme.pk}/").status_code == 403


def test_an_artist_reads_no_deliveries(rows):
    project = ProjectFactory.create(code="CR53A")
    api = as_role("artist", project)

    assert api.get(f"{API}/deliveries/?project={project.pk}").status_code == 403
