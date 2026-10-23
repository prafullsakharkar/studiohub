"""The masterdata admin only looks (PLAN WP 8.2, finding L1)."""

from __future__ import annotations

import pytest
from django.contrib import admin
from django.test import RequestFactory
from django.urls import reverse

from apps.identity.tests.factories import UserFactory
from apps.masterdata import admin as masterdata_admin  # noqa: F401  (registers the models)
from apps.masterdata.models import ClientContract, Person, VendorContract
from apps.masterdata.tests.factories import (
    ClientContactFactory,
    ClientContractFactory,
    ClientFactory,
    DepartmentFactory,
    OfficeFactory,
    PersonFactory,
    PositionFactory,
    SoftwareFactory,
    TeamFactory,
    VendorContractFactory,
    VendorFactory,
)

pytestmark = pytest.mark.django_db

MODELS = sorted(
    (m for m in admin.site._registry if m._meta.app_label == "masterdata"),
    key=lambda m: m.__name__,
)


@pytest.fixture
def superuser_client(client):
    user = UserFactory.create(is_staff=True, is_superuser=True)
    client.force_login(user)
    return client


def url(model, name, *args):
    return reverse(f"admin:masterdata_{model._meta.model_name}_{name}", args=args)


def test_every_masterdata_model_is_registered():
    from django.apps import apps

    expected = {m for m in apps.get_app_config("masterdata").get_models()}
    assert expected <= set(MODELS), sorted(m.__name__ for m in expected - set(MODELS))


@pytest.mark.parametrize("model", MODELS, ids=lambda m: m.__name__)
class TestReadOnly:
    def test_the_list_renders_and_offers_no_actions(self, superuser_client, model):
        response = superuser_client.get(url(model, "changelist"))
        assert response.status_code == 200
        assert b'name="action"' not in response.content  # no bulk "delete selected"
        assert url(model, "add").encode() not in response.content  # no "add" link

    def test_add_change_and_delete_are_forbidden(self, superuser_client, model):
        assert superuser_client.get(url(model, "add")).status_code == 403
        assert superuser_client.post(url(model, "add"), {}).status_code == 403
        model_admin = admin.site._registry[model]
        request = RequestFactory().get("/")
        assert not model_admin.has_add_permission(request)
        assert not model_admin.has_change_permission(request)
        assert not model_admin.has_delete_permission(request)
        assert model_admin.get_actions(request) == {}


def _detail(superuser_client, instance):
    return superuser_client.get(url(type(instance), "change", instance.pk))


def test_a_detail_page_is_view_only(superuser_client):
    row = DepartmentFactory(name="Compositing")
    response = _detail(superuser_client, row)
    assert response.status_code == 200
    assert b"Compositing" in response.content
    assert b'name="_save"' not in response.content
    assert (
        superuser_client.post(url(type(row), "change", row.pk), {"name": "Hacked"}).status_code
        == 403
    )
    row.refresh_from_db()
    assert row.name == "Compositing"
    assert (
        superuser_client.post(url(type(row), "delete", row.pk), {"post": "yes"}).status_code == 403
    )
    assert type(row).objects.filter(pk=row.pk).exists()


def test_personal_and_financial_fields_are_not_shown(superuser_client):
    person = PersonFactory(
        name="Zed Unique-Name", email="zed.unique@example.com", phone="+1 555 0199"
    )
    client = ClientFactory(
        contact_name="Quinn Unique-Contact",
        email="quinn.unique@example.com",
        total_billed_usd=987654,
    )
    vendor = VendorFactory(contact_name="Vera Unique-Vendor", email="vera.unique@example.com")
    contact = ClientContactFactory(name="Cleo Unique-Contact", email="cleo.unique@example.com")
    contract = ClientContractFactory(value_usd=424242)
    vcontract = VendorContractFactory(total_value_usd=737373)
    secrets = (
        "Zed Unique-Name",
        "zed.unique",
        "555 0199",
        "Quinn Unique",
        "quinn.unique",
        "987654",
        "Vera Unique",
        "vera.unique",
        "Cleo Unique",
        "cleo.unique",
        "424242",
        "737373",
    )
    for instance in (person, client, vendor, contact, contract, vcontract):
        for page in (
            _detail(superuser_client, instance),
            superuser_client.get(url(type(instance), "changelist")),
        ):
            assert page.status_code == 200
            text = page.content.decode()
            leaked = [s for s in secrets if s in text]
            assert not leaked, (type(instance).__name__, leaked)


def test_other_models_render_their_detail_pages(superuser_client):
    for instance in (OfficeFactory(), PositionFactory(), TeamFactory(), SoftwareFactory()):
        assert _detail(superuser_client, instance).status_code == 200


def test_the_financial_list_is_declared():
    assert masterdata_admin.FINANCIAL_FIELDS[ClientContract] == ("value_usd",)
    assert masterdata_admin.FINANCIAL_FIELDS[VendorContract] == ("total_value_usd",)
    assert "name" in Person.audit_exclude_fields
