"""Client, vendor and contact service rules (CONTRACTS §4.1, §4.2)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import Client, ClientContact, ClientContract, VendorContact
from apps.masterdata.services.contact import ClientContactService, VendorContactService
from apps.masterdata.services.partner import ClientService, VendorService
from apps.masterdata.tests.factories import (
    ClientContactFactory,
    ClientContractFactory,
    ClientFactory,
    VendorContractFactory,
    VendorFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def actor():
    return UserFactory.create()


def _in_force(factory, **kw):
    today = timezone.localdate()
    return factory(
        status="Active",
        activated_at=timezone.now(),
        effective_date=today - timedelta(days=5),
        expiry_date=today + timedelta(days=5),
        **kw,
    )


class TestClientCrud:
    def test_create_normalizes_and_records_the_actor(self, actor):
        client = ClientService.create(
            actor=actor,
            data={
                "code": " APEX ",
                "name": " Apex ",
                "email": " Ops@Apex.VFX ",
                "phone": "+1  (514) 555-0101",
                "total_billed_usd": "1250.5",
            },
        )
        assert (client.code, client.name) == ("APEX", "Apex")
        assert client.email == "ops@apex.vfx"
        assert client.phone == "+1 (514) 555-0101"
        assert client.total_billed_usd == Decimal("1250.50")
        assert client.created_by == actor

    def test_the_billed_total_has_no_default_and_may_be_cleared(self, actor):
        client = ClientService.create(actor=actor, data={"code": "A", "name": "A"})
        assert client.total_billed_usd is None
        client = ClientService.update(actor=actor, instance=client, data={"total_billed_usd": "5"})
        assert client.total_billed_usd == Decimal("5.00")
        client = ClientService.update(actor=actor, instance=client, data={"total_billed_usd": None})
        assert client.total_billed_usd is None

    @pytest.mark.parametrize("bad", ["-1", "abc", "1e99"])
    def test_a_bad_billed_total_is_refused(self, actor, bad):
        with pytest.raises(ValidationError) as caught:
            ClientService.create(
                actor=actor, data={"code": "A", "name": "A", "total_billed_usd": bad}
            )
        assert "total_billed_usd" in caught.value.message_dict

    @pytest.mark.parametrize("email", ["nope", "a@b", "a b@c.io"])
    def test_a_bad_email_is_refused(self, actor, email):
        with pytest.raises(ValidationError) as caught:
            ClientService.create(actor=actor, data={"code": "A", "name": "A", "email": email})
        assert "email" in caught.value.message_dict

    @pytest.mark.parametrize("phone", ["call me", "555-0100; DROP", "<b>1</b>"])
    def test_a_phone_with_letters_or_markup_is_refused(self, actor, phone):
        with pytest.raises(ValidationError) as caught:
            ClientService.create(actor=actor, data={"code": "A", "name": "A", "phone": phone})
        assert "phone" in caught.value.message_dict

    def test_code_is_unique_ignoring_case_among_live_rows(self, actor):
        ClientFactory(code="apex", name="One")
        with pytest.raises(ValidationError) as caught:
            ClientService.create(actor=actor, data={"code": "APEX", "name": "Two"})
        assert set(caught.value.message_dict) == {"code"}

    def test_a_deleted_clients_code_can_be_reused(self, actor):
        old = ClientFactory(code="apex")
        ClientService.soft_delete(actor=actor, instance=old)
        assert ClientService.create(actor=actor, data={"code": "apex", "name": "New"}).pk != old.pk

    def test_restore_refuses_when_the_code_was_taken(self, actor):
        old = ClientFactory(code="apex")
        ClientService.soft_delete(actor=actor, instance=old)
        ClientService.create(actor=actor, data={"code": "apex", "name": "New"})
        with pytest.raises(ValidationError):
            ClientService.restore(actor=actor, instance=old)

    def test_unknown_fields_are_a_programming_error(self, actor):
        with pytest.raises(ValueError):
            ClientService.create(actor=actor, data={"code": "A", "name": "A", "id": "x"})

    def test_update_changes_only_what_it_is_given(self, actor):
        client = ClientFactory(code="A", name="A", email="a@x.io", total_billed_usd=Decimal("9"))
        ClientService.update(actor=actor, instance=client, data={"name": "B"})
        client.refresh_from_db()
        assert (client.name, client.email, client.total_billed_usd) == ("B", "a@x.io", Decimal("9"))


class TestVendorCrud:
    @pytest.mark.parametrize("rating", ["5.01", "-0.1", "x"])
    def test_rating_is_between_zero_and_five(self, actor, rating):
        with pytest.raises(ValidationError) as caught:
            VendorService.create(actor=actor, data={"code": "V", "name": "V", "rating": rating})
        assert "rating" in caught.value.message_dict

    def test_a_vendor_is_created_and_audited_by_field_names_only(
        self, actor, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            VendorService.create(
                actor=actor,
                data={"code": "V", "name": "V", "contact_name": "Jane Doe", "email": "j@x.io"},
            )
        log = AuditLog.objects.get(target_type="masterdata")
        assert log.metadata["fields"] == ["code", "contact_name", "email", "name"]
        assert "Jane Doe" not in str(log.metadata) and "j@x.io" not in str(log.metadata)


class TestPartnerDelete:
    def test_soft_delete_cascades_to_contacts_and_contracts_with_one_timestamp(self, actor):
        client = ClientFactory()
        contact = ClientContactFactory(client=client)
        contract = ClientContractFactory(client=client)
        ClientService.soft_delete(actor=actor, instance=client)
        for model, row in ((Client, client), (ClientContact, contact), (ClientContract, contract)):
            fresh = model.all_objects.get(pk=row.pk)
            assert (
                fresh.is_deleted
                and fresh.deleted_at == Client.all_objects.get(pk=client.pk).deleted_at
            )

    def test_a_client_with_a_contract_in_force_cannot_be_deleted(self, actor):
        client = ClientFactory()
        _in_force(ClientContractFactory, client=client)
        with pytest.raises(MasterdataConflict) as caught:
            ClientService.soft_delete(actor=actor, instance=client)
        assert caught.value.code == "has_dependants"
        assert Client.objects.filter(pk=client.pk).exists()

    def test_an_elapsed_active_contract_does_not_block_the_delete(self, actor):
        client = ClientFactory()
        today = timezone.localdate()
        ClientContractFactory(
            client=client,
            status="Active",
            activated_at=timezone.now(),
            effective_date=today - timedelta(days=30),
            expiry_date=today - timedelta(days=1),
        )
        ClientService.soft_delete(actor=actor, instance=client)
        assert not Client.objects.filter(pk=client.pk).exists()

    def test_a_vendor_with_a_contract_in_force_cannot_be_deleted(self, actor):
        vendor = VendorFactory()
        _in_force(VendorContractFactory, vendor=vendor)
        with pytest.raises(MasterdataConflict):
            VendorService.soft_delete(actor=actor, instance=vendor)

    def test_restore_brings_back_only_what_the_cascade_removed(self, actor):
        client = ClientFactory()
        kept_out = ClientContactFactory(client=client)
        ClientContactService.soft_delete(actor=actor, instance=kept_out)
        cascaded = ClientContactFactory(client=client)
        ClientService.soft_delete(actor=actor, instance=client)
        ClientService.restore(actor=actor, instance=Client.all_objects.get(pk=client.pk))
        assert ClientContact.objects.filter(pk=cascaded.pk).exists()
        assert not ClientContact.objects.filter(pk=kept_out.pk).exists()

    def test_hard_delete_needs_a_soft_deleted_row(self, actor):
        client = ClientFactory()
        with pytest.raises(MasterdataConflict) as caught:
            ClientService.hard_delete(actor=actor, instance=client)
        assert caught.value.code == "not_soft_deleted"
        ClientService.soft_delete(actor=actor, instance=client)
        ClientService.hard_delete(actor=actor, instance=Client.all_objects.get(pk=client.pk))
        assert not Client.all_objects.filter(pk=client.pk).exists()

    def test_hard_delete_is_refused_while_deleted_children_remain(self, actor):
        # PROTECT on the FKs: a hard delete never silently takes contacts or contracts with it.
        client = ClientFactory()
        ClientContactFactory(client=client)
        ClientService.soft_delete(actor=actor, instance=client)
        with pytest.raises(MasterdataConflict):
            ClientService.hard_delete(actor=actor, instance=Client.all_objects.get(pk=client.pk))


class TestContacts:
    def test_a_contact_needs_its_owner(self, actor):
        with pytest.raises(ValueError):
            ClientContactService.create(actor=actor, data={"name": "Jane"})

    def test_email_is_lower_cased_and_unique_per_owner_only(self, actor):
        a, b = ClientFactory(), ClientFactory()
        ClientContactService.create(actor=actor, parent=a, data={"name": "J", "email": "J@X.io"})
        other = ClientContactService.create(
            actor=actor, parent=b, data={"name": "J", "email": "j@x.io"}
        )
        assert other.email == "j@x.io"
        with pytest.raises(ValidationError) as caught:
            ClientContactService.create(
                actor=actor, parent=a, data={"name": "K", "email": "j@X.IO"}
            )
        assert "email" in caught.value.message_dict

    def test_making_a_contact_primary_demotes_the_previous_one(self, actor):
        client = ClientFactory()
        first = ClientContactService.create(
            actor=actor, parent=client, data={"name": "A", "is_primary": True}
        )
        second = ClientContactService.create(
            actor=actor, parent=client, data={"name": "B", "is_primary": True}
        )
        first.refresh_from_db()
        assert (first.is_primary, second.is_primary) == (False, True)
        ClientContactService.update(actor=actor, instance=first, data={"is_primary": True})
        second.refresh_from_db()
        assert (ClientContact.objects.get(pk=first.pk).is_primary, second.is_primary) == (
            True,
            False,
        )

    def test_primary_is_per_owner(self, actor):
        a, b = ClientFactory(), ClientFactory()
        ClientContactService.create(actor=actor, parent=a, data={"name": "A", "is_primary": True})
        ClientContactService.create(actor=actor, parent=b, data={"name": "B", "is_primary": True})
        assert ClientContact.objects.filter(is_primary=True).count() == 2

    def test_vendor_contacts_follow_the_same_rules(self, actor):
        vendor = VendorFactory()
        VendorContactService.create(
            actor=actor, parent=vendor, data={"name": "A", "is_primary": True}
        )
        VendorContactService.create(
            actor=actor, parent=vendor, data={"name": "B", "is_primary": True}
        )
        assert VendorContact.objects.filter(vendor=vendor, is_primary=True).count() == 1

    def test_a_deleted_contacts_email_can_be_reused_and_restore_then_refuses(self, actor):
        client = ClientFactory()
        old = ClientContactFactory(client=client, email="j@x.io")
        ClientContactService.soft_delete(actor=actor, instance=old)
        ClientContactService.create(
            actor=actor, parent=client, data={"name": "New", "email": "j@x.io"}
        )
        with pytest.raises(ValidationError):
            ClientContactService.restore(actor=actor, instance=old)

    def test_restoring_a_primary_contact_refuses_when_another_is_primary(self, actor):
        client = ClientFactory()
        old = ClientContactFactory(client=client, is_primary=True)
        ClientContactService.soft_delete(actor=actor, instance=old)
        ClientContactFactory(client=client, is_primary=True)
        with pytest.raises(MasterdataConflict):
            ClientContactService.restore(actor=actor, instance=old)

    def test_a_contact_cannot_be_restored_under_a_deleted_owner(self, actor):
        client = ClientFactory()
        contact = ClientContactFactory(client=client)
        ClientContactService.soft_delete(actor=actor, instance=contact)
        ClientService.soft_delete(actor=actor, instance=client)
        with pytest.raises(MasterdataConflict):
            ClientContactService.restore(
                actor=actor, instance=ClientContact.all_objects.get(pk=contact.pk)
            )

    def test_the_audit_event_for_a_contact_carries_no_name(
        self, actor, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            ClientContactService.create(
                actor=actor,
                parent=ClientFactory(),
                data={"name": "Jane Doe", "email": "jane@x.io", "phone": "+1 555 0100"},
            )
        log = AuditLog.objects.get(target_type="masterdata")
        blob = f"{log.target_name} {log.description} {log.metadata}"
        assert "Jane" not in blob and "jane@x.io" not in blob and "555" not in blob
        assert log.metadata["fields"] == ["email", "name", "phone"]
