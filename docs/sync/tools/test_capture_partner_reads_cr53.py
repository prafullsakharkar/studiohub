"""
CR-53 evidence: what an artist (and a vendor-side member) reads of clients, vendors, contracts and deliveries.

Clients, vendors and their contracts are readable by every signed-in user (``ServiceRecordViewSet.read_permissions``
is empty); only contacts, ``total_billed_usd`` and the contract values are gated. The project dashboard returns the
delivery cards, with the client's name, to anyone who may read the project, whether or not they hold
``delivery.view``. Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_partner_reads_cr53.py
"""

from __future__ import annotations

import json
import os
from decimal import Decimal
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])


def call(client, name, method, path, flow):
    resp = getattr(client, method.lower())(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    flow[name] = {"request": {"method": method, "path": path}, "status": resp.status_code, "body": body}
    return flow[name]


def as_user(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_capture_partner_reads_cr53(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    with open(os.devnull, "w") as quiet:
        call_command("init_platform", stdout=quiet, stderr=quiet)

    from apps.deliveries.tests.helpers import make_package
    from apps.identity.models import Role, UserRole
    from apps.masterdata.tests.factories import (
        ClientContractFactory,
        ClientFactory,
        VendorContractFactory,
        VendorFactory,
    )
    from apps.production.models import ProjectMembership
    from apps.production.tests.factories import ProjectFactory

    def member(email, role_code):
        user = django_user_model.objects.create_user(email=email, password="Cr53-Pass-Phrase!9")
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
        return user

    acme = ClientFactory.create(code="ACME", name="Acme Pictures", total_billed_usd=Decimal("1250000.00"))
    VendorFactory.create(code="NLR", name="Northern Light Render")
    contract = ClientContractFactory.create(client=acme, value_usd=Decimal("480000.00"))
    VendorContractFactory.create(vendor__code="FXH", vendor__name="FX House", total_value_usd=Decimal("90000.00"))
    project = ProjectFactory.create(code="CRT", client_id=str(acme.pk), client_name=acme.name)
    make_package(project, client_id=acme.pk, name="Episode 1 turnover")

    artist = member("artist@example.test", "artist")
    lead = member("lead@example.test", "lead-artist")

    flow: dict[str, dict] = {}
    for who, client in (("artist", as_user(artist)), ("lead", as_user(lead))):
        call(client, f"clients_list_{who}", "GET", "/api/v1/clients/", flow)
        call(client, f"client_detail_{who}", "GET", f"/api/v1/clients/{acme.pk}/", flow)
        call(client, f"vendors_list_{who}", "GET", "/api/v1/vendors/", flow)
        call(client, f"client_contracts_list_{who}", "GET", "/api/v1/client-contracts/", flow)
        call(client, f"client_contract_detail_{who}", "GET", f"/api/v1/client-contracts/{contract.pk}/", flow)
        call(client, f"vendor_contracts_list_{who}", "GET", "/api/v1/vendor-contracts/", flow)
        call(client, f"client_contacts_list_{who}", "GET", "/api/v1/client-contacts/", flow)
        call(client, f"deliveries_list_{who}", "GET", f"/api/v1/deliveries/?project={project.pk}", flow)
        call(client, f"dashboard_{who}", "GET", f"/api/v1/projects/{project.pk}/dashboard/", flow)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "masterdata").mkdir(exist_ok=True)
    (OUT / "masterdata" / "_partner_reads_cr53.json").write_text(json.dumps(flow, indent=2, default=str) + "\n")
