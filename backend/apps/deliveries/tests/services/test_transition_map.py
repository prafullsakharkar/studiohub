# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
The transition map (DOM-DLV-02): every (from, to) pair behaves as the table says, every move leaves
a history row, the permission code is checked per move, and nothing but ``transitions.move`` writes
the status.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from rest_framework.exceptions import ValidationError

from apps.deliveries.constants import workflow as wf
from apps.deliveries.constants.permissions import DeliveryPermissions as P
from apps.deliveries.exceptions import InvalidTransition, TransitionNotPermitted
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange
from apps.deliveries.services import transitions
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import (
    _Request,
    make_package,
    package_with_items,
    prepared_package,
    signed_off_package,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions

pytestmark = pytest.mark.django_db

ALL = sorted(wf.STATUSES)
PAIRS = [(a, b) for a in ALL for b in ALL]


def _package_in(status: str) -> DeliveryPackage:
    package = make_package()
    DeliveryPackage.objects.filter(pk=package.pk).update(status=status)
    return DeliveryPackage.objects.get(pk=package.pk)


def test_the_map_names_every_status_and_every_target_is_a_status():
    assert set(wf.TRANSITIONS) == wf.STATUSES
    for targets in wf.TRANSITIONS.values():
        assert set(targets) <= wf.STATUSES


@pytest.mark.parametrize(("source", "target"), PAIRS)
def test_every_pair_is_allowed_only_if_the_map_says_so(source, target):
    package = _package_in(source)
    allowed = wf.can_move(source, target)
    overridable = wf.needs_override(source, target)

    if allowed:
        kind = transitions.move(package, target, actor=None)
        assert kind == ""
        assert DeliveryPackage.objects.get(pk=package.pk).status == target
        last = DeliveryStatusChange.objects.filter(delivery=package).latest("at", "id")
        assert (last.from_status, last.to_status) == (source, target)
    elif overridable:
        # Out of a sent or cancelled delivery: an ordinary move is the map's 409. Only a caller
        # that asks for the override gets one, and then a reason comes first, then the permission.
        with pytest.raises(InvalidTransition):
            transitions.move(package, target, actor=None)
        with pytest.raises(ValidationError):
            transitions.move(package, target, actor=None, override_reason="  ")
        with pytest.raises(TransitionNotPermitted):
            transitions.move(package, target, actor=None, override_reason="because")
        assert DeliveryPackage.objects.get(pk=package.pk).status == source
    else:
        with pytest.raises(InvalidTransition):
            transitions.move(package, target, actor=None)
        assert DeliveryPackage.objects.get(pk=package.pk).status == source


def test_a_move_to_the_same_status_is_never_allowed():
    for status in ALL:
        assert not wf.can_move(status, status) and not wf.needs_override(status, status)


def test_working_states_move_freely_among_themselves():
    for a in wf.WORKING_STATES:
        for b in wf.WORKING_STATES - {a}:
            assert wf.required_permission(a, b) == P.UPDATE


@pytest.mark.parametrize(
    ("source", "target", "code"),
    [
        (wf.PREPARED, wf.SIGNED_OFF, P.APPROVE),
        (wf.SIGNED_OFF, wf.PREPARED, P.APPROVE),
        (wf.SIGNED_OFF, wf.CANCELLED, P.APPROVE),
        (wf.SIGNED_OFF, wf.SUBMITTED, P.SEND),
        (wf.SUBMITTED, wf.APPROVED, P.SEND),
        (wf.SUBMITTED, wf.REJECTED, P.SEND),
        (wf.APPROVED, wf.COMPLETE, P.UPDATE),
        (wf.DRAFT, wf.CANCELLED, P.UPDATE),
    ],
)
def test_each_move_needs_the_code_the_map_names(source, target, code):
    assert wf.required_permission(source, target) == code


class TestPermissionIsCheckedPerMove:
    def test_cancelling_a_signed_off_delivery_needs_approve_not_just_update(self):
        package = signed_off_package()
        editor = UserFactory.create()
        grant_permissions(editor, P.UPDATE)

        with pytest.raises(TransitionNotPermitted):
            DeliveryService.cancel(actor=editor, package=package, request=_Request(editor))
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Signed Off"

        approver = UserFactory.create()
        grant_permissions(approver, P.APPROVE)
        done = DeliveryService.cancel(
            actor=approver, package=package, reason="Client paused", request=_Request(approver)
        )
        assert done.status == "Cancelled"

    def test_cancelling_a_working_delivery_needs_only_update(self):
        package = package_with_items()
        editor = UserFactory.create()
        grant_permissions(editor, P.UPDATE)

        done = DeliveryService.cancel(actor=editor, package=package, request=_Request(editor))

        assert done.status == "Cancelled"

    def test_a_call_without_a_request_is_trusted(self):
        done = DeliveryService.cancel(actor=None, package=package_with_items())

        assert done.status == "Cancelled"


class TestHistory:
    def test_creation_and_every_move_leave_a_row_with_the_actor(self):
        actor = UserFactory.create()
        package = DeliveryService.create(
            actor=actor,
            data={"name": "x", "project_id": make_package().project.pk},
        )
        DeliveryService.cancel(actor=actor, package=package, reason="Not needed")

        rows = list(DeliveryStatusChange.objects.filter(delivery=package).order_by("at", "id"))
        assert [(r.from_status, r.to_status) for r in rows] == [
            ("", "Draft"),
            ("Draft", "Cancelled"),
        ]
        assert {r.actor_id for r in rows} == {actor.pk}
        assert rows[1].reason == "Not needed" and rows[1].override_kind == ""

    def test_the_history_is_append_only(self):
        package = make_package()
        row = DeliveryStatusChange.objects.get(delivery=package)

        row.reason = "edited"
        with pytest.raises(TypeError):
            row.save()
        with pytest.raises(TypeError):
            row.delete()
        with pytest.raises(TypeError):
            DeliveryStatusChange.objects.update(reason="x")
        with pytest.raises(TypeError):
            DeliveryStatusChange.objects.all().delete()

    def test_a_delivery_with_history_cannot_be_hard_deleted(self):
        from django.db.models import ProtectedError

        package = make_package()

        with pytest.raises(ProtectedError):
            DeliveryPackage.all_objects.filter(pk=package.pk).delete()


class TestTheOverride:
    def _correct(self, user, package, target, reason="Client confirmed by phone"):
        return DeliveryService.override_status(
            actor=user,
            package=package,
            target=target,
            override_reason=reason,
            request=_Request(user),
        )

    def test_needs_a_reason_and_the_explicit_code(self):
        package = _package_in("Cancelled")
        holder = UserFactory.create()
        grant_permissions(holder, P.STATUS_OVERRIDE)

        with pytest.raises(ValidationError):
            self._correct(holder, package, "Draft", reason="  ")

        done = self._correct(holder, package, "Draft")

        assert done.status == "Draft"
        row = DeliveryStatusChange.objects.filter(delivery=package).latest("at", "id")
        assert row.override_kind == "status" and row.reason == "Client confirmed by phone"
        assert row.actor_id == holder.pk

    def test_a_superuser_does_not_hold_it(self):
        package = _package_in("Complete")
        boss = UserFactory.create(is_superuser=True)

        with pytest.raises(TransitionNotPermitted):
            self._correct(boss, package, "Draft")
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Complete"

    def test_the_ordinary_update_code_is_not_enough(self):
        package = _package_in("Submitted")
        editor = UserFactory.create()
        grant_permissions(editor, P.UPDATE, P.APPROVE, P.SEND)

        with pytest.raises(TransitionNotPermitted):
            self._correct(editor, package, "Prepared")

    def test_it_is_audited_as_a_warning(self):
        from apps.audit.models import AuditLog

        package = _package_in("Cancelled")
        holder = UserFactory.create()
        grant_permissions(holder, P.STATUS_OVERRIDE)

        self._correct(holder, package, "Draft")

        row = AuditLog.objects.filter(target_id=str(package.pk), description__contains="override")
        assert row.count() == 1 and row.get().severity == AuditLog.SEVERITY_WARNING
        assert "Client confirmed" not in row.get().description

    def test_it_cannot_leave_a_working_state_outside_the_map(self):
        package = prepared_package()
        holder = UserFactory.create()
        grant_permissions(holder, P.STATUS_OVERRIDE)

        with pytest.raises(InvalidTransition):
            self._correct(holder, package, "Submitted")


class TestOnlyTheServiceWritesTheStatus:
    SOURCES = Path(__file__).resolve().parents[2]

    def test_no_other_module_assigns_or_updates_the_status(self):
        pattern = re.compile(
            r"\b(locked|package|delivery|old|new)\.status\s*=[^=]|\.update\([^)]*\bstatus="
        )
        offenders = []
        for path in self.SOURCES.rglob("*.py"):
            relative = path.relative_to(self.SOURCES).as_posix()
            if relative.startswith(("tests/", "migrations/")) or relative.endswith(
                "services/transitions.py"
            ):
                continue
            for number, line in enumerate(path.read_text().splitlines(), 1):
                if pattern.search(line) and not line.lstrip().startswith("#"):
                    offenders.append(f"{relative}:{number}: {line.strip()}")
        assert offenders == []

    def test_actions_and_patch_cannot_move_a_delivery_outside_the_map(self, staff_client):
        package = make_package(code="MAP-1")

        for action in ("complete", "approve", "reopen", "sign-off"):
            response = staff_client.post(
                f"/api/v1/deliveries/{package.pk}/{action}/", {}, format="json"
            )
            assert response.status_code == 409, (action, response.content)
        reject = staff_client.post(
            f"/api/v1/deliveries/{package.pk}/reject/", {"rejection_reason": "x"}, format="json"
        )
        patched = staff_client.patch(
            f"/api/v1/deliveries/{package.pk}/", {"status": "Complete"}, format="json"
        )

        assert reject.status_code == 409 and patched.status_code == 400
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Draft"
