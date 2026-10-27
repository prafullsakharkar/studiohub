# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
The workflow after sign-off (DOM-DLV-02, DOM-DLV-11): the client's answer, complete, cancel,
reopen, retry and revise. Reasons live in their own columns, never in the client's notes.
"""

from __future__ import annotations

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.deliveries.constants.permissions import DeliveryPermissions as P
from apps.deliveries.exceptions import InvalidTransition, TransitionNotPermitted
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange
from apps.deliveries.services.package import AlreadyRevised, DeliveryService
from apps.deliveries.tests.helpers import (
    _Request,
    client_for,
    make_package,
    package_with_items,
    prepared_package,
    published_version,
    signed_off_package,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Version

pytestmark = pytest.mark.django_db


def _sent():
    return DeliveryService.send(actor=UserFactory.create(), package=signed_off_package())


class TestTheClientsAnswer:
    def test_approval_records_who_when_and_the_clients_notes(self):
        recorder = UserFactory.create()

        done = DeliveryService.record_client_answer(
            actor=recorder, package=_sent(), accepted=True, notes="Great work"
        )

        assert done.status == "Approved" and done.client_status == "Approved"
        assert done.client_answered_by == recorder and done.client_answered_at
        assert done.client_notes == "Great work" and done.rejection_reason == ""

    def test_rejection_needs_a_reason_and_keeps_it_out_of_the_clients_notes(self):
        package = _sent()

        with pytest.raises(ValidationError):
            DeliveryService.record_client_answer(actor=None, package=package, accepted=False)
        with pytest.raises(ValidationError):
            DeliveryService.record_client_answer(
                actor=None, package=package, accepted=False, reason="   "
            )

        done = DeliveryService.record_client_answer(
            actor=None, package=package, accepted=False, reason="Colour is off in shot 12"
        )

        assert done.status == "Rejected" and done.client_status == "Rejected"
        assert done.rejection_reason == "Colour is off in shot 12"
        assert done.client_notes == ""
        row = DeliveryStatusChange.objects.filter(delivery=package, to_status="Rejected").get()
        assert row.reason == "Colour is off in shot 12"

    @pytest.mark.parametrize("state", ["Draft", "Prepared", "Signed Off", "Approved", "Cancelled"])
    def test_only_a_sent_delivery_gets_an_answer(self, state):
        package = make_package()
        DeliveryPackage.objects.filter(pk=package.pk).update(status=state)

        with pytest.raises(InvalidTransition):
            DeliveryService.record_client_answer(actor=None, package=package, accepted=True)

    def test_answering_needs_the_send_code_when_a_request_is_given(self):
        package = _sent()
        editor = UserFactory.create()
        grant_permissions(editor, P.UPDATE, P.APPROVE)

        with pytest.raises(TransitionNotPermitted):
            DeliveryService.record_client_answer(
                actor=editor, package=package, accepted=True, request=_Request(editor)
            )

    def test_the_answer_is_audited_without_the_text(self):
        package = _sent()

        DeliveryService.record_client_answer(
            actor=None, package=package, accepted=False, reason="Secret reason text"
        )

        rows = AuditLog.objects.filter(target_id=str(package.pk), target_type="delivery")
        assert not [r for r in rows if "Secret reason text" in f"{r.description} {r.metadata}"]


class TestCompleteAndCancel:
    def test_complete_follows_approval_only(self):
        approved = DeliveryService.record_client_answer(actor=None, package=_sent(), accepted=True)

        assert DeliveryService.complete(actor=None, package=approved).status == "Complete"
        with pytest.raises(InvalidTransition):
            DeliveryService.complete(actor=None, package=_sent())

    def test_cancel_keeps_the_reason_in_its_own_column(self):
        package = package_with_items()

        done = DeliveryService.cancel(actor=None, package=package, reason="Client paused the show")

        assert done.status == "Cancelled"
        assert done.cancellation_reason == "Client paused the show" and done.client_notes == ""

    @pytest.mark.parametrize(
        "state", ["Submitted", "Approved", "Rejected", "Complete", "Cancelled"]
    )
    def test_a_sent_or_cancelled_delivery_cannot_be_cancelled(self, state):
        package = make_package()
        DeliveryPackage.objects.filter(pk=package.pk).update(status=state)

        with pytest.raises(InvalidTransition):
            DeliveryService.cancel(actor=None, package=package)


class TestReopenAndRetry:
    def test_reopen_clears_the_sign_off_and_makes_the_delivery_editable_again(self):
        package = signed_off_package()
        signer = package.signed_off_by

        done = DeliveryService.reopen(actor=signer, package=package)

        assert done.status == "Prepared"
        assert done.signed_off_by_id is None and done.signed_off_at is None
        assert DeliveryService.add_version(
            actor=None, package=done, version_id=published_version(done.project).pk
        )

    def test_reopen_only_works_on_a_signed_off_delivery(self):
        with pytest.raises(InvalidTransition):
            DeliveryService.reopen(actor=None, package=prepared_package())

    def test_reopen_needs_the_approve_code_when_a_request_is_given(self):
        package = signed_off_package()
        editor = UserFactory.create()
        grant_permissions(editor, P.UPDATE)

        with pytest.raises(TransitionNotPermitted):
            DeliveryService.reopen(actor=editor, package=package, request=_Request(editor))

    def test_retry_runs_qc_again_only_while_validating(self):
        package = package_with_items()
        DeliveryService.validate(actor=None, package=package)
        before = DeliveryPackage.objects.get(pk=package.pk).qc_run_id

        done = DeliveryService.retry(actor=None, package=package)

        assert done.status == "Validating" and done.qc_run_id not in (None, before)
        for state in ("Draft", "Prepared", "Signed Off", "Submitted", "Cancelled"):
            DeliveryPackage.objects.filter(pk=package.pk).update(status=state)
            with pytest.raises(InvalidTransition):
                DeliveryService.retry(actor=None, package=package)


class TestRevise:
    def _rejected(self, **fields):
        package = signed_off_package(**fields)
        sent = DeliveryService.send(actor=UserFactory.create(), package=package)
        return DeliveryService.record_client_answer(
            actor=None, package=sent, accepted=False, reason="Redo the grade"
        )

    def test_a_new_draft_with_the_same_versions_is_made(self):
        rejected = self._rejected(passcode="OLD-PASSCODE")
        reviser = UserFactory.create()

        new, skipped = DeliveryService.revise(actor=reviser, package=rejected)

        assert skipped == []
        assert new.status == "Draft" and new.revision_of_id == rejected.pk
        assert new.code != rejected.code and new.project_id == rejected.project_id
        assert new.versions.count() == 1 and new.versions.get().files.count() == 1
        assert new.versions.get().files.get().frozen_at is None
        assert new.passcode == "" and new.sent_at is None and new.signed_off_by_id is None
        assert new.created_by == reviser
        assert DeliveryPackage.objects.get(pk=rejected.pk).status == "Rejected"
        creation = DeliveryStatusChange.objects.get(delivery=new, from_status="")
        assert creation.actor_id == reviser.pk

    def test_a_version_that_is_no_longer_deliverable_is_reported_not_dropped_silently(self):
        rejected = self._rejected()
        version = Version.objects.get(delivery_references__delivery=rejected)
        Version.objects.filter(pk=version.pk).update(is_published=False)

        new, skipped = DeliveryService.revise(actor=None, package=rejected)

        assert skipped == [{"version_id": str(version.pk), "reason": "not_published"}]
        assert new.versions.count() == 0

    def test_only_a_rejected_delivery_is_revised_and_only_once(self):
        with pytest.raises(InvalidTransition):
            DeliveryService.revise(actor=None, package=signed_off_package())
        rejected = self._rejected()
        first, _ = DeliveryService.revise(actor=None, package=rejected)

        with pytest.raises(AlreadyRevised):
            DeliveryService.revise(actor=None, package=rejected)

        DeliveryService.cancel(actor=None, package=first)
        again, _ = DeliveryService.revise(actor=None, package=rejected)
        assert again.pk != first.pk

    def test_the_revision_goes_through_the_whole_flow_again(self):
        rejected = self._rejected()
        new, _ = DeliveryService.revise(actor=None, package=rejected)

        prepared, _ = DeliveryService.prepare(actor=None, package=new)
        signed = DeliveryService.sign_off(actor=UserFactory.create(), package=prepared)
        sent = DeliveryService.send(actor=UserFactory.create(), package=signed)

        assert sent.status == "Submitted" and sent.revision_of_id == rejected.pk


class TestEndpoints:
    def test_the_whole_flow_through_the_api(self):
        preparer = client_for(UserFactory.create(is_superuser=True))
        signer = client_for(UserFactory.create(is_superuser=True))
        package = package_with_items(code="FLOW-API")
        base = f"/api/v1/deliveries/{package.pk}"

        assert preparer.post(f"{base}/prepare/", {}, format="json").status_code == 200
        assert signer.post(f"{base}/sign-off/", {}, format="json").status_code == 200
        assert preparer.post(f"{base}/submit/", {}, format="json").status_code == 200
        approved = signer.post(f"{base}/approve/", {"client_notes": "Thanks"}, format="json")
        done = signer.post(f"{base}/complete/", {}, format="json")

        assert approved.status_code == 200 and approved.json()["client_status"] == "Approved"
        assert done.json()["status"] == "Completed"

    def test_reject_then_revise_returns_201_with_the_new_draft(self):
        user = client_for(UserFactory.create(is_superuser=True))
        sent = _sent()
        base = f"/api/v1/deliveries/{sent.pk}"

        missing = user.post(f"{base}/reject/", {}, format="json")
        rejected = user.post(
            f"{base}/reject/", {"rejection_reason": "Wrong frame rate"}, format="json"
        )
        revised = user.post(f"{base}/revise/", {}, format="json")

        assert missing.status_code == 400
        assert rejected.json()["rejection_reason"] == "Wrong frame rate"
        assert revised.status_code == 201
        body = revised.json()
        assert body["status"] == "Draft" and body["revision_of"] == str(sent.pk)
        assert body["skipped_versions"] == []
        assert user.post(f"{base}/revise/", {}, format="json").status_code == 409

    def test_history_and_qc_are_readable(self):
        user = client_for(UserFactory.create(is_superuser=True))
        package = signed_off_package()

        history = user.get(f"/api/v1/deliveries/{package.pk}/history/").json()
        checks = user.get(f"/api/v1/deliveries/{package.pk}/qc/").json()

        assert [(r["from_status"], r["to_status"]) for r in history] == [
            ("", "Draft"),
            ("Draft", "Prepared"),
            ("Prepared", "Signed Off"),
        ]
        assert {c["check_name"] for c in checks} >= {"has_items", "snapshot_current"}
        assert all(c["outcome"] in {"pass", "not_checked"} for c in checks)

    def test_the_detail_shows_the_workflow_fields(self):
        user = client_for(UserFactory.create(is_superuser=True))
        package = signed_off_package()

        body = user.get(f"/api/v1/deliveries/{package.pk}/").json()

        assert body["status"] == "Signed Off" and body["signed_off_at"]
        assert body["signed_off_by"] and body["has_revoked_content"] is False
        assert body["cancellation_reason"] == "" and body["revision_of"] is None

    def test_each_action_needs_its_own_code(self):
        package = signed_off_package()
        base = f"/api/v1/deliveries/{package.pk}"
        viewer = UserFactory.create()
        grant_permissions(viewer, P.VIEW, P.UPDATE, P.CREATE)
        client = client_for(viewer)

        assert client.post(f"{base}/submit/", {}, format="json").status_code == 403
        assert client.post(f"{base}/reopen/", {}, format="json").status_code == 403
        assert client.post(f"{base}/approve/", {}, format="json").status_code == 403
        assert client.post(f"{base}/revise/", {}, format="json").status_code == 403
        assert client.get(f"{base}/passcode/").status_code == 403
        assert client.get(f"{base}/history/").status_code == 200
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Signed Off"
