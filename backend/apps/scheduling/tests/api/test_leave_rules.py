# Django adds <fk>_id attributes at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Leave rules (docs/scheduling/CONTRACTS.md DOM-SCH-05, decisions Q19, Q28):

* everyone files leave for their own resource with ``schedule.create``; for someone else's needs
  ``schedule.manage`` (anyone else is told "Unknown resource", the same as for an unknown id);
* a resource has no two pending or approved leaves that overlap;
* deciding needs ``schedule.approve``; nobody decides their own leave, except a holder of
  ``schedule.sod.override`` who gives a reason, recorded as an override.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest

from apps.audit.models import AuditLog
from apps.scheduling.models import ResourceLeave
from apps.scheduling.tests.helpers import (
    ALL_CODES,
    APPROVE,
    CREATE,
    MANAGE,
    SOD_OVERRIDE,
    UPDATE,
    VIEW,
    client_for,
    default_calendar,
    make_resource,
    person,
)

pytestmark = pytest.mark.django_db

URL = "/api/v1/scheduling/leaves/"


@pytest.fixture(autouse=True)
def calendar():
    return default_calendar()


def _artist(*extra):
    """A person with their own resource and the codes an artist holds (view, create)."""
    user = person(VIEW, CREATE, *extra)
    return user, make_resource(user=user), client_for(user)


def _body(first="2026-09-01", last="2026-09-03", **extra):
    return {
        "leave_type": "Vacation",
        "start_date": first,
        "end_date": last,
        "reason": "private reason",
        **extra,
    }


def _leave(resource, first=date(2026, 9, 1), last=date(2026, 9, 3), status="Pending"):
    return ResourceLeave.objects.create(
        resource=resource,
        leave_type="Vacation",
        start_date=first,
        end_date=last,
        total_days=3,
        status=status,
        reason="private reason",
    )


class TestFilingLeave:
    def test_an_artist_files_leave_for_their_own_resource(self):
        _, resource, api = _artist()

        response = api.post(URL, _body(), format="json")

        assert response.status_code == 201, response.content
        assert response.json()["resource"] == str(resource.pk)
        assert response.json()["status"] == "Pending"

    def test_naming_their_own_resource_is_fine(self):
        _, resource, api = _artist()

        assert api.post(URL, _body(resource=str(resource.pk)), format="json").status_code == 201

    def test_someone_elses_resource_reads_like_an_unknown_one(self):
        _, _, api = _artist()
        theirs = make_resource()

        foreign = api.post(URL, _body(resource=str(theirs.pk)), format="json")
        unknown = api.post(URL, _body(resource=str(uuid.uuid4())), format="json")

        def shape(response):
            body = response.json()
            body.get("error", {}).pop("request_id", None)
            return response.status_code, body

        assert foreign.status_code == 400
        assert "Unknown resource." in foreign.content.decode()
        assert shape(foreign) == shape(unknown)
        assert ResourceLeave.objects.count() == 0

    def test_a_manager_files_leave_for_anyone(self):
        manager = client_for(person(VIEW, CREATE, MANAGE))
        theirs = make_resource()

        response = manager.post(URL, _body(resource=str(theirs.pk)), format="json")

        assert response.status_code == 201 and response.json()["resource"] == str(theirs.pk)

    def test_without_a_resource_of_their_own_and_none_named_it_is_a_400(self):
        api = client_for(person(VIEW, CREATE))

        response = api.post(URL, _body(), format="json")

        assert response.status_code == 400
        assert "No scheduling resource is associated" in response.content.decode()

    def test_a_manager_without_a_resource_must_name_one(self):
        api = client_for(person(VIEW, CREATE, MANAGE))

        assert api.post(URL, _body(), format="json").status_code == 400


class TestEditingLeave:
    def test_a_person_edits_their_own_pending_request_with_create_alone(self):
        _, resource, api = _artist()
        leave = _leave(resource)

        response = api.patch(f"{URL}{leave.pk}/", {"reason": "changed"}, format="json")

        assert response.status_code == 200, response.content

    def test_a_person_cannot_edit_someone_elses_request(self):
        _, _, api = _artist()
        leave = _leave(make_resource())

        response = api.patch(f"{URL}{leave.pk}/", {"reason": "mine now"}, format="json")

        assert response.status_code == 403
        assert ResourceLeave.objects.get(pk=leave.pk).reason == "private reason"

    def test_a_manager_edits_anyones_pending_request(self):
        manager = client_for(person(VIEW, CREATE, MANAGE))
        leave = _leave(make_resource())

        assert manager.patch(f"{URL}{leave.pk}/", {"reason": "x"}, format="json").status_code == 200

    def test_a_request_cannot_be_moved_to_another_resource_even_by_a_manager(self):
        manager = client_for(person(VIEW, CREATE, MANAGE))
        leave = _leave(make_resource())
        other = make_resource()

        response = manager.patch(f"{URL}{leave.pk}/", {"resource": str(other.pk)}, format="json")

        assert response.status_code == 400 and "another resource" in response.content.decode()

    def test_naming_the_same_resource_again_is_fine(self):
        manager = client_for(person(VIEW, CREATE, MANAGE))
        leave = _leave(make_resource())

        response = manager.patch(
            f"{URL}{leave.pk}/", {"resource": str(leave.resource_id)}, format="json"
        )

        assert response.status_code == 200

    def test_a_decided_request_cannot_be_edited(self):
        _, resource, api = _artist()
        leave = _leave(resource, status="Approved")

        assert api.patch(f"{URL}{leave.pk}/", {"reason": "x"}, format="json").status_code == 400


class TestOverlap:
    def test_a_second_overlapping_request_is_a_400_naming_the_dates(self):
        _, resource, api = _artist()
        _leave(resource, date(2026, 9, 1), date(2026, 9, 5))

        response = api.post(URL, _body("2026-09-04", "2026-09-08"), format="json")

        assert response.status_code == 400
        assert "2026-09-01 to 2026-09-05" in response.content.decode()
        assert ResourceLeave.objects.count() == 1

    @pytest.mark.parametrize("status", ["Pending", "Approved"])
    def test_pending_and_approved_leave_both_hold_the_days(self, status):
        _, resource, api = _artist()
        _leave(resource, status=status)

        assert api.post(URL, _body("2026-09-02", "2026-09-02"), format="json").status_code == 400

    @pytest.mark.parametrize("status", ["Rejected", "Cancelled"])
    def test_rejected_and_cancelled_leave_free_them(self, status):
        _, resource, api = _artist()
        _leave(resource, status=status)

        assert api.post(URL, _body(), format="json").status_code == 201

    def test_the_next_day_and_the_day_before_are_free(self):
        _, resource, api = _artist()
        _leave(resource, date(2026, 9, 10), date(2026, 9, 12))

        assert api.post(URL, _body("2026-09-07", "2026-09-09"), format="json").status_code == 201
        assert api.post(URL, _body("2026-09-13", "2026-09-15"), format="json").status_code == 201

    def test_another_resource_may_take_the_same_days(self):
        _, resource, api = _artist()
        _leave(make_resource())

        assert api.post(URL, _body(), format="json").status_code == 201

    def test_deleted_leave_does_not_hold_days(self):
        _, resource, api = _artist()
        _leave(resource).soft_delete()

        assert api.post(URL, _body(), format="json").status_code == 201

    def test_a_manager_filing_for_someone_is_held_to_the_same_rule(self):
        manager = client_for(person(VIEW, CREATE, MANAGE))
        resource = make_resource()
        _leave(resource)

        response = manager.post(URL, _body(resource=str(resource.pk)), format="json")

        assert response.status_code == 400

    def test_editing_the_dates_into_an_overlap_is_refused_and_a_harmless_edit_is_not(self):
        _, resource, api = _artist()
        _leave(resource, date(2026, 9, 10), date(2026, 9, 12))
        mine = _leave(resource, date(2026, 9, 1), date(2026, 9, 3))

        clash = api.patch(f"{URL}{mine.pk}/", {"end_date": "2026-09-11"}, format="json")
        shrink = api.patch(f"{URL}{mine.pk}/", {"end_date": "2026-09-02"}, format="json")
        note = api.patch(f"{URL}{mine.pk}/", {"reason": "x"}, format="json")

        assert clash.status_code == 400
        assert shrink.status_code == 200 and note.status_code == 200


class TestDeciding:
    def test_deciding_needs_the_approve_code_not_update(self):
        leave = _leave(make_resource())
        updater = client_for(person(VIEW, CREATE, UPDATE, MANAGE))
        approver = client_for(person(VIEW, APPROVE))

        assert updater.post(f"{URL}{leave.pk}/approve/").status_code == 403
        assert (
            updater.post(f"{URL}{leave.pk}/reject/", {"rejection_reason": "x"}).status_code == 403
        )
        assert approver.post(f"{URL}{leave.pk}/approve/").status_code == 200

    def test_nobody_decides_their_own_leave(self):
        user = person(*ALL_CODES)
        leave = _leave(make_resource(user=user))
        api = client_for(user)

        for action, body in (("approve", {}), ("reject", {"rejection_reason": "x"})):
            response = api.post(f"{URL}{leave.pk}/{action}/", body, format="json")
            assert response.status_code == 403, action
        assert ResourceLeave.objects.get(pk=leave.pk).status == "Pending"

    def test_a_superuser_does_not_hold_the_override_by_being_one(self):
        user = person(superuser=True)
        leave = _leave(make_resource(user=user))

        response = client_for(user).post(
            f"{URL}{leave.pk}/approve/", {"override_reason": "sole manager"}, format="json"
        )

        assert response.status_code == 403

    def test_a_holder_of_the_override_decides_their_own_with_a_reason_and_it_is_recorded(self):
        user = person(*ALL_CODES, SOD_OVERRIDE)
        resource = make_resource(user=user)
        leave = _leave(resource)

        response = client_for(user).post(
            f"{URL}{leave.pk}/approve/", {"override_reason": "only manager on shift"}, format="json"
        )

        assert response.status_code == 200, response.content
        leave.refresh_from_db()
        assert leave.status == "Approved" and leave.approved_by_id == user.pk
        row = AuditLog.objects.get(target_type="scheduling", target_id=str(leave.pk))
        assert row.metadata["overridden"] is True
        assert row.metadata["override_reason"] == "only manager on shift"
        assert row.severity == "warning"

    def test_the_override_needs_a_reason(self):
        user = person(*ALL_CODES, SOD_OVERRIDE)
        leave = _leave(make_resource(user=user))
        api = client_for(user)

        for body in ({}, {"override_reason": ""}, {"override_reason": "   "}):
            response = api.post(f"{URL}{leave.pk}/approve/", body, format="json")
            assert response.status_code == 400, body
            assert "override_reason" in response.content.decode()
        assert ResourceLeave.objects.get(pk=leave.pk).status == "Pending"

    def test_the_override_also_covers_rejecting_one_own_request(self):
        user = person(*ALL_CODES, SOD_OVERRIDE)
        leave = _leave(make_resource(user=user))

        response = client_for(user).post(
            f"{URL}{leave.pk}/reject/",
            {"rejection_reason": "plans changed", "override_reason": "withdrawing"},
            format="json",
        )

        assert response.status_code == 200 and response.json()["status"] == "Rejected"

    def test_holding_the_override_changes_nothing_for_other_peoples_leave(self):
        user = person(*ALL_CODES, SOD_OVERRIDE)
        leave = _leave(make_resource())

        response = client_for(user).post(f"{URL}{leave.pk}/approve/", {}, format="json")

        assert response.status_code == 200
        row = AuditLog.objects.get(target_type="scheduling", target_id=str(leave.pk))
        assert row.metadata["overridden"] is False and "override_reason" not in row.metadata

    def test_reject_takes_the_reason_under_either_name(self):
        approver = client_for(person(VIEW, APPROVE))
        first, second = _leave(make_resource()), _leave(make_resource())

        a = approver.post(f"{URL}{first.pk}/reject/", {"rejection_reason": "busy"}, format="json")
        b = approver.post(f"{URL}{second.pk}/reject/", {"reason": "busy"}, format="json")

        assert a.status_code == b.status_code == 200
        assert ResourceLeave.objects.get(pk=second.pk).rejection_reason == "busy"

    def test_a_rejection_without_a_reason_is_a_400(self):
        approver = client_for(person(VIEW, APPROVE))
        leave = _leave(make_resource())

        assert approver.post(f"{URL}{leave.pk}/reject/", {}, format="json").status_code == 400


class TestWhoSeesTheReasons:
    def test_approvers_and_the_person_see_them_and_updaters_do_not(self):
        owner_user = person(VIEW, CREATE)
        leave = _leave(make_resource(user=owner_user))
        seen = {}
        for name, user in {
            "owner": owner_user,
            "approver": person(VIEW, APPROVE),
            "updater": person(VIEW, CREATE, UPDATE, MANAGE),
            "reader": person(VIEW),
        }.items():
            seen[name] = client_for(user).get(f"{URL}{leave.pk}/").json()["reason"]

        assert seen == {
            "owner": "private reason",
            "approver": "private reason",
            "updater": "",
            "reader": "",
        }


class TestTheServiceHoldsTheRulesToo:
    """The serializer and the service each refuse; neither relies on the other."""

    def test_filing_for_someone_elses_resource_without_manage_is_refused_by_the_service(self):
        from rest_framework.exceptions import ValidationError

        from apps.scheduling.services.leave import create_leave

        user = person(VIEW, CREATE)
        data = {"start_date": date(2026, 9, 1), "end_date": date(2026, 9, 3)}

        with pytest.raises(ValidationError, match="Unknown resource"):
            create_leave(actor=user, manager=False, requested=make_resource(), data=data)
        assert ResourceLeave.objects.count() == 0

    def test_a_manager_may_and_the_person_may_for_their_own(self):
        from apps.scheduling.services.leave import create_leave

        user = person(VIEW, CREATE)
        own = make_resource(user=user)
        data = {"start_date": date(2026, 9, 1), "end_date": date(2026, 9, 3)}

        assert (
            create_leave(actor=user, manager=False, requested=own, data=data).resource_id == own.pk
        )
        other = make_resource()
        assert (
            create_leave(actor=user, manager=True, requested=other, data=data).resource_id
            == other.pk
        )

    def test_changing_someone_elses_request_without_manage_is_refused_by_the_service(self):
        from rest_framework.exceptions import PermissionDenied

        from apps.scheduling.services.leave import update_leave

        leave = _leave(make_resource())

        with pytest.raises(PermissionDenied):
            update_leave(
                actor=person(VIEW, CREATE), manager=False, leave=leave, data={"reason": "x"}
            )
