"""Contract lifecycle, derived status and the MSA overlap rule (CONTRACTS §4.3, DECISIONS D8)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import ClientContract, VendorContract
from apps.masterdata.services.contract import ClientContractService, VendorContractService
from apps.masterdata.tests.factories import (
    ClientContractFactory,
    ClientFactory,
    VendorContractFactory,
    VendorFactory,
)

pytestmark = pytest.mark.django_db

TODAY = timezone.localdate()


def day(offset: int):
    return TODAY + timedelta(days=offset)


@pytest.fixture
def actor():
    return UserFactory.create()


@pytest.fixture
def client():
    return ClientFactory()


def create(actor, client, **data):
    payload = {
        "contract_number": f"C-{ClientContract.all_objects.count() + 1}",
        "title": "T",
        "type": "SOW",
        "status": "Draft",
        **data,
    }
    return ClientContractService.create(actor=actor, parent=client, data=payload)


def msa(actor, client, start, end, **data):
    return create(
        actor,
        client,
        type="MSA",
        status="Active",
        effective_date=start,
        expiry_date=end,
        **data,
    )


class TestCreate:
    def test_the_status_defaults_to_active_as_before(self, actor, client):
        payload = {"contract_number": "C", "title": "T", "type": "SOW", "effective_date": day(-1)}
        row = ClientContractService.create(actor=actor, parent=client, data=payload)
        assert row.status == "Active" and row.activated_at is not None

    def test_without_a_start_date_the_default_is_refused_not_downgraded(self, actor, client):
        payload = {"contract_number": "C", "title": "T", "type": "SOW"}
        with pytest.raises(ValidationError) as caught:
            ClientContractService.create(actor=actor, parent=client, data=payload)
        assert "effective_date" in caught.value.message_dict

    def test_a_contract_is_created_as_draft_or_active_only(self, actor, client):
        for bad in ("Terminated", "Expired", "bogus"):
            with pytest.raises(ValidationError) as caught:
                create(actor, client, status=bad)
            assert "status" in caught.value.message_dict

    def test_an_active_contract_needs_a_start_date(self, actor, client):
        with pytest.raises(ValidationError) as caught:
            create(actor, client, status="Active")
        assert "effective_date" in caught.value.message_dict

    def test_a_draft_may_have_no_dates(self, actor, client):
        row = create(actor, client, status="Draft")
        assert row.effective_date is None and row.activated_at is None

    def test_activating_on_create_stamps_activated_at(self, actor, client):
        row = create(actor, client, status="Active", effective_date=day(-1))
        assert row.activated_at is not None

    def test_the_end_cannot_precede_the_start(self, actor, client):
        with pytest.raises(ValidationError) as caught:
            create(actor, client, effective_date=day(5), expiry_date=day(4))
        assert "expiry_date" in caught.value.message_dict

    def test_a_one_day_contract_is_allowed(self, actor, client):
        assert create(actor, client, effective_date=day(5), expiry_date=day(5))

    def test_the_contract_number_is_unique_per_owner_ignoring_case(self, actor, client):
        create(actor, client, contract_number="MSA-1")
        with pytest.raises(ValidationError) as caught:
            create(actor, client, contract_number="msa-1")
        assert "contract_number" in caught.value.message_dict
        create(actor, ClientFactory(), contract_number="MSA-1")  # another owner is fine

    @pytest.mark.parametrize("amount", ["-1", "abc", "1.5"])
    def test_a_bad_amount_is_refused(self, actor, client, amount):
        with pytest.raises(ValidationError) as caught:
            create(actor, client, value_usd=amount)
        assert "value_usd" in caught.value.message_dict

    def test_the_currency_must_be_known(self, actor, client):
        with pytest.raises(ValidationError) as caught:
            create(actor, client, currency="XXX")
        assert "currency" in caught.value.message_dict

    def test_a_document_url_must_be_http(self, actor, client):
        with pytest.raises(ValidationError) as caught:
            create(actor, client, document_url="javascript:alert(1)")
        assert "document_url" in caught.value.message_dict


class TestDerivedStatus:
    def row(self, **kw):
        return ClientContractFactory(
            status="Active", activated_at=timezone.now(), effective_date=day(-30), **kw
        )

    def test_active_until_and_including_the_end_date(self):
        assert self.row(expiry_date=day(0)).effective_status() == "Active"
        assert self.row(expiry_date=day(1)).effective_status() == "Active"

    def test_expired_the_day_after_the_end_date(self):
        assert self.row(expiry_date=day(-1)).effective_status() == "Expired"

    def test_an_open_ended_contract_never_expires(self):
        assert self.row(expiry_date=None).effective_status() == "Active"

    def test_draft_and_terminated_are_reported_as_stored(self):
        assert ClientContractFactory(status="Draft").effective_status() == "Draft"
        assert (
            ClientContractFactory(status="Terminated", expiry_date=day(-9)).effective_status()
            == "Terminated"
        )

    def test_the_boundary_follows_the_date_it_is_given(self):
        row = self.row(expiry_date=day(0))
        assert row.effective_status(day(0)) == "Active"
        assert row.effective_status(day(1)) == "Expired"


class TestUpdate:
    def test_status_cannot_be_changed_through_update(self, actor, client):
        row = create(actor, client)
        with pytest.raises(ValueError):
            ClientContractService.update(actor=actor, instance=row, data={"status": "Active"})

    def test_editing_a_draft_or_active_contract_works(self, actor, client):
        row = create(actor, client, status="Active", effective_date=day(-1), expiry_date=day(10))
        row = ClientContractService.update(actor=actor, instance=row, data={"title": "New"})
        assert row.title == "New"

    def test_an_expired_contract_is_read_only(self, actor, client):
        row = ClientContractFactory(
            client=client,
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-20),
            expiry_date=day(-1),
        )
        with pytest.raises(MasterdataConflict) as caught:
            ClientContractService.update(actor=actor, instance=row, data={"title": "x"})
        assert caught.value.code == "invalid_transition"

    def test_a_terminated_contract_is_read_only(self, actor, client):
        row = ClientContractFactory(client=client, status="Terminated")
        with pytest.raises(MasterdataConflict):
            ClientContractService.update(actor=actor, instance=row, data={"title": "x"})

    def test_an_active_contract_cannot_be_edited_to_end_in_the_past(self, actor, client):
        row = create(actor, client, status="Active", effective_date=day(-10), expiry_date=day(10))
        with pytest.raises(ValidationError) as caught:
            ClientContractService.update(actor=actor, instance=row, data={"expiry_date": day(-1)})
        assert "expiry_date" in caught.value.message_dict


class TestTransitions:
    def test_activate_a_draft(self, actor, client):
        row = create(actor, client, effective_date=day(-1), expiry_date=day(30))
        row = ClientContractService.activate(actor=actor, contract=row)
        assert row.status == "Active" and row.activated_at is not None

    def test_activate_needs_a_start_date(self, actor, client):
        row = create(actor, client)
        with pytest.raises(ValidationError) as caught:
            ClientContractService.activate(actor=actor, contract=row)
        assert "effective_date" in caught.value.message_dict

    def test_activate_refuses_an_end_date_already_past(self, actor, client):
        row = create(actor, client, effective_date=day(-10), expiry_date=day(-2))
        with pytest.raises(ValidationError):
            ClientContractService.activate(actor=actor, contract=row)

    @pytest.mark.parametrize("state", ["Active", "Terminated"])
    def test_only_a_draft_can_be_activated(self, actor, client, state):
        row = ClientContractFactory(
            client=client,
            status=state,
            effective_date=day(-5),
            activated_at=timezone.now(),
            expiry_date=day(5),
        )
        with pytest.raises(MasterdataConflict) as caught:
            ClientContractService.activate(actor=actor, contract=row)
        assert caught.value.code == "invalid_transition"

    def test_terminating_an_open_contract_ends_it_today(self, actor, client):
        row = msa(actor, client, day(-10), None)
        row = ClientContractService.terminate(actor=actor, contract=row)
        assert (row.status, row.expiry_date) == ("Terminated", TODAY)
        assert row.activated_at is not None

    def test_terminating_a_contract_that_ends_later_ends_it_today(self, actor, client):
        row = msa(actor, client, day(-10), day(40))
        assert ClientContractService.terminate(actor=actor, contract=row).expiry_date == TODAY

    def test_terminating_keeps_an_end_date_that_is_today_or_earlier(self, actor, client):
        row = msa(actor, client, day(-10), day(0))
        assert ClientContractService.terminate(actor=actor, contract=row).expiry_date == day(0)

    def test_terminating_one_that_has_not_started_releases_its_range(self, actor, client):
        row = msa(actor, client, day(10), day(20))
        row = ClientContractService.terminate(actor=actor, contract=row)
        assert row.status == "Terminated" and row.activated_at is None
        # nothing is occupied now: the same range can be taken again
        msa(actor, client, day(10), day(20), contract_number="MSA-AGAIN")

    def test_terminating_a_draft_occupies_nothing(self, actor, client):
        row = create(actor, client, type="MSA", effective_date=day(-5), expiry_date=day(5))
        ClientContractService.terminate(actor=actor, contract=row)
        msa(actor, client, day(-5), day(5), contract_number="MSA-2")

    def test_a_terminated_or_expired_contract_cannot_be_terminated_again(self, actor, client):
        done = ClientContractFactory(client=client, status="Terminated")
        gone = ClientContractFactory(
            client=client,
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-9),
            expiry_date=day(-1),
        )
        for row in (done, gone):
            with pytest.raises(MasterdataConflict):
                ClientContractService.terminate(actor=actor, contract=row)

    def test_each_transition_is_audited_with_from_and_to(
        self, actor, client, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            row = create(actor, client, effective_date=day(-1))
            ClientContractService.activate(actor=actor, contract=row)
            ClientContractService.terminate(actor=actor, contract=row)
        transitions = [
            log.metadata["transition"]
            for log in AuditLog.objects.filter(target_type="masterdata").order_by("created_at")
            if "transition" in log.metadata
        ]
        assert transitions == [
            {"from": "Draft", "to": "Active"},
            {"from": "Active", "to": "Terminated"},
        ]


class TestOverlap:
    def test_a_second_overlapping_msa_is_refused(self, actor, client):
        msa(actor, client, day(-10), day(10))
        with pytest.raises(MasterdataConflict) as caught:
            msa(actor, client, day(5), day(20), contract_number="MSA-2")
        assert caught.value.code == "contract_overlap"

    def test_the_boundary_day_overlaps_and_the_next_day_does_not(self, actor, client):
        msa(actor, client, day(0), day(10))
        with pytest.raises(MasterdataConflict):
            msa(actor, client, day(10), day(20), contract_number="MSA-2")
        with pytest.raises(MasterdataConflict):
            msa(actor, client, day(-10), day(0), contract_number="MSA-3")
        assert msa(actor, client, day(11), day(20), contract_number="MSA-4")
        assert msa(actor, client, day(-10), day(-1), contract_number="MSA-5")

    def test_an_open_ended_msa_overlaps_every_later_range(self, actor, client):
        msa(actor, client, day(0), None)
        with pytest.raises(MasterdataConflict):
            msa(actor, client, day(500), day(600), contract_number="MSA-2")
        assert msa(actor, client, day(-50), day(-1), contract_number="MSA-3")

    def test_a_new_open_ended_msa_overlaps_a_later_one(self, actor, client):
        msa(actor, client, day(100), day(200))
        with pytest.raises(MasterdataConflict):
            msa(actor, client, day(0), None, contract_number="MSA-2")

    def test_a_contained_range_overlaps(self, actor, client):
        msa(actor, client, day(0), day(100))
        with pytest.raises(MasterdataConflict):
            msa(actor, client, day(10), day(20), contract_number="MSA-2")

    def test_sows_may_overlap_each_other_and_an_msa(self, actor, client):
        msa(actor, client, day(0), day(100))
        for n in range(3):
            create(
                actor,
                client,
                type="SOW",
                status="Active",
                effective_date=day(10),
                expiry_date=day(20),
                contract_number=f"SOW-{n}",
            )

    def test_the_type_comparison_ignores_case(self, actor, client):
        msa(actor, client, day(0), day(10))
        with pytest.raises(MasterdataConflict):
            create(
                actor,
                client,
                type="msa",
                status="Active",
                effective_date=day(5),
                expiry_date=day(6),
                contract_number="MSA-2",
            )

    def test_a_draft_msa_can_overlap_but_cannot_be_activated_into_a_clash(self, actor, client):
        msa(actor, client, day(0), day(10))
        draft = create(
            actor,
            client,
            type="MSA",
            effective_date=day(5),
            expiry_date=day(15),
            contract_number="MSA-2",
        )
        with pytest.raises(MasterdataConflict) as caught:
            ClientContractService.activate(actor=actor, contract=draft)
        assert caught.value.code == "contract_overlap"

    def test_owners_are_independent(self, actor, client):
        msa(actor, client, day(0), day(10))
        assert msa(actor, ClientFactory(), day(0), day(10))

    def test_a_backdated_msa_overlapping_an_elapsed_active_one_is_blocked(self, actor, client):
        # Expired stays derived, so the elapsed range is still occupied (D8).
        ClientContractFactory(
            client=client,
            type="MSA",
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-100),
            expiry_date=day(-50),
        )
        with pytest.raises(MasterdataConflict):
            msa(actor, client, day(-60), day(-40), contract_number="MSA-2")

    def test_a_terminated_msa_that_was_active_keeps_its_range(self, actor, client):
        row = msa(actor, client, day(-10), None)
        ClientContractService.terminate(actor=actor, contract=row)  # now covers -10 .. today
        with pytest.raises(MasterdataConflict):
            msa(actor, client, day(-5), day(5), contract_number="MSA-2")
        assert msa(actor, client, day(1), day(30), contract_number="MSA-3")

    def test_an_overlap_found_while_editing_dates_is_refused(self, actor, client):
        msa(actor, client, day(0), day(10))
        other = msa(actor, client, day(11), day(20), contract_number="MSA-2")
        with pytest.raises(MasterdataConflict):
            ClientContractService.update(
                actor=actor, instance=other, data={"effective_date": day(5)}
            )

    def test_restore_refuses_when_the_range_was_taken(self, actor, client):
        row = msa(actor, client, day(0), day(10))
        ClientContractService.soft_delete(actor=actor, instance=row)
        msa(actor, client, day(0), day(10), contract_number="MSA-2")
        with pytest.raises(MasterdataConflict) as caught:
            ClientContractService.restore(
                actor=actor, instance=ClientContract.all_objects.get(pk=row.pk)
            )
        assert caught.value.code == "contract_overlap"

    def test_vendors_follow_the_same_rule(self, actor):
        vendor = VendorFactory()

        def vmsa(start, end, number):
            return VendorContractService.create(
                actor=actor,
                parent=vendor,
                data={
                    "contract_number": number,
                    "title": "T",
                    "type": "MSA",
                    "status": "Active",
                    "effective_date": start,
                    "expiry_date": end,
                },
            )

        vmsa(day(0), day(10), "V-1")
        with pytest.raises(MasterdataConflict):
            vmsa(day(10), day(20), "V-2")
        assert vmsa(day(11), day(20), "V-3")


class TestAdjustEndDate:
    def test_it_corrects_an_expired_msa_so_a_backdated_one_fits(self, actor, client):
        old = ClientContractFactory(
            client=client,
            type="MSA",
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-100),
            expiry_date=day(-10),
        )
        adjusted = ClientContractService.adjust_end_date(
            actor=actor, contract=old, expiry_date=day(-70)
        )
        assert adjusted.expiry_date == day(-70) and adjusted.effective_status() == "Expired"
        assert msa(actor, client, day(-60), day(-40), contract_number="MSA-2")

    def test_it_never_revives_an_elapsed_or_terminated_contract(self, actor, client):
        old = ClientContractFactory(
            client=client,
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-100),
            expiry_date=day(-10),
        )
        for end in (day(0), day(30), None):
            with pytest.raises(ValidationError):
                ClientContractService.adjust_end_date(actor=actor, contract=old, expiry_date=end)

    def test_it_cannot_end_before_the_start(self, actor, client):
        old = ClientContractFactory(
            client=client,
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-100),
            expiry_date=day(-10),
        )
        with pytest.raises(ValidationError):
            ClientContractService.adjust_end_date(actor=actor, contract=old, expiry_date=day(-101))

    def test_a_draft_was_never_in_force(self, actor, client):
        with pytest.raises(MasterdataConflict):
            ClientContractService.adjust_end_date(
                actor=actor, contract=create(actor, client), expiry_date=day(1)
            )

    def test_a_terminated_draft_was_never_in_force(self, actor, client):
        row = ClientContractFactory(client=client, status="Terminated", activated_at=None)
        with pytest.raises(MasterdataConflict):
            ClientContractService.adjust_end_date(actor=actor, contract=row, expiry_date=day(-1))

    def test_an_active_contract_can_be_shortened_but_not_into_the_past(self, actor, client):
        row = msa(actor, client, day(-10), day(50))
        row = ClientContractService.adjust_end_date(actor=actor, contract=row, expiry_date=day(5))
        assert row.expiry_date == day(5)
        with pytest.raises(ValidationError):
            ClientContractService.adjust_end_date(actor=actor, contract=row, expiry_date=day(-1))

    def test_the_change_is_audited_with_both_dates(
        self, actor, client, django_capture_on_commit_callbacks
    ):
        row = ClientContractFactory(
            client=client,
            status="Active",
            activated_at=timezone.now(),
            effective_date=day(-100),
            expiry_date=day(-10),
        )
        with django_capture_on_commit_callbacks(execute=True):
            ClientContractService.adjust_end_date(actor=actor, contract=row, expiry_date=day(-20))
        log = AuditLog.objects.get(target_type="masterdata")
        assert log.metadata["event"] == "ContractEndDateAdjusted"
        assert log.metadata["dates"] == {"from": day(-10).isoformat(), "to": day(-20).isoformat()}

    def test_an_unchanged_end_date_writes_nothing(
        self, actor, client, django_capture_on_commit_callbacks
    ):
        row = msa(actor, client, day(-10), day(50))
        with django_capture_on_commit_callbacks(execute=True):
            ClientContractService.adjust_end_date(actor=actor, contract=row, expiry_date=day(50))
        assert not AuditLog.objects.filter(metadata__event="ContractEndDateAdjusted").exists()


def test_vendor_contract_value_field_is_total_value_usd(actor):
    row = VendorContractService.create(
        actor=actor,
        parent=VendorContractFactory().vendor,
        data={
            "contract_number": "V",
            "title": "T",
            "type": "SOW",
            "status": "Draft",
            "total_value_usd": 500,
        },
    )
    assert VendorContract.objects.get(pk=row.pk).total_value_usd == 500
