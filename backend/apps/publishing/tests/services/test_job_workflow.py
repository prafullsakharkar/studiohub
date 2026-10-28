"""
Export job workflow (DOM-PUB-05, decisions Q14 and Q27): one map, one writer of the status,
every other move refused with 409 ``invalid_transition``.
"""

from __future__ import annotations

import itertools
import re
from pathlib import Path

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.publishing.constants import workflow as wf
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.exceptions import InvalidTransition, JobNotEditable, TransitionNotPermitted
from apps.publishing.models import PublishItem, PublishValidationRule
from apps.publishing.services.jobs import create_job
from apps.publishing.services.workflow import JobService
from apps.publishing.tests.helpers import member, request_for

pytestmark = pytest.mark.django_db

STATES = sorted(wf.JOB_STATUSES)

BODY = {
    "name": "Rig export",
    "entity_type": "Shot",
    "entity_id": "x",
    "entity_code": "SH010",
    "entity_name": "Opening",
    "dcc_tool": "Maya",
    "source_file": "work/a.ma",
}


@pytest.fixture
def make_job(project):
    def build(status: str = "Pending", **over) -> PublishItem:
        job = create_job(actor=None, data={**BODY, "project_id": str(project.pk), **over})
        if status != "Pending":
            PublishItem.objects.filter(pk=job.pk).update(status=status)
        return PublishItem.objects.get(pk=job.pk)

    return build


@pytest.fixture
def override_holder(project):
    return member(project, P.VIEW, P.UPDATE, P.STATUS_OVERRIDE)


class TestTheMap:
    def test_it_is_closed_over_the_known_statuses(self):
        assert set(wf.JOB_TRANSITIONS) == wf.JOB_STATUSES
        for targets in wf.JOB_TRANSITIONS.values():
            assert targets <= wf.JOB_STATUSES
        assert wf.JOB_GUARDED_STATES <= wf.JOB_STATUSES
        assert wf.JOB_OVERRIDE_TARGETS <= wf.JOB_STATUSES

    def test_the_model_and_the_map_name_the_same_statuses(self):
        assert {value for value, _ in PublishItem.STATUS_CHOICES} == wf.JOB_STATUSES

    def test_finished_jobs_have_no_working_exit(self):
        assert wf.JOB_TRANSITIONS[wf.JOB_EXPORTED] == frozenset()
        assert wf.JOB_TRANSITIONS[wf.JOB_CANCELLED] == frozenset()

    @pytest.mark.parametrize(("source", "target"), itertools.product(STATES, STATES))
    def test_every_pair_passes_or_fails_as_the_map_says(
        self, make_job, override_holder, source, target
    ):
        job = make_job(source)
        working = wf.can_move_job(source, target)
        needs_override = wf.job_move_needs_override(source, target)

        if not working and not needs_override:
            with pytest.raises(InvalidTransition):
                JobService.move(actor=None, job=job, target=target)
            assert PublishItem.objects.get(pk=job.pk).status == source
            return
        if needs_override:
            with pytest.raises(ValidationError):  # a reason is required
                JobService.move(actor=None, job=job, target=target)
            with pytest.raises(TransitionNotPermitted):  # and the explicit code
                JobService.move(actor=None, job=job, target=target, override_reason="x")
            moved = JobService.move(
                actor=override_holder,
                job=job,
                target=target,
                request=request_for(override_holder),
                override_reason="reopened by mistake",
            )
        else:
            moved = JobService.move(actor=None, job=job, target=target)
        assert moved.status == target

    def test_an_unknown_target_is_refused(self, make_job):
        with pytest.raises(InvalidTransition):
            JobService.move(actor=None, job=make_job(), target="Published")


class TestOverride:
    def test_a_superuser_does_not_hold_it_by_being_one(self, make_job, project):
        boss = member(project, P.UPDATE, is_superuser=True)

        with pytest.raises(TransitionNotPermitted):
            JobService.move(
                actor=boss,
                job=make_job("Cancelled"),
                target="Pending",
                request=request_for(boss),
                override_reason="oops",
            )

    def test_an_override_is_audited_as_one(self, make_job, override_holder):
        job = make_job("Exported")

        JobService.move(
            actor=override_holder,
            job=job,
            target="Pending",
            request=request_for(override_holder),
            override_reason="re-export",
        )

        row = AuditLog.objects.filter(target_id=str(job.pk)).latest("created_at")
        assert "override" in row.description and row.metadata["override"] is True

    def test_it_only_leads_back_to_pending(self, make_job, override_holder):
        with pytest.raises(InvalidTransition):
            JobService.move(
                actor=override_holder,
                job=make_job("Exported"),
                target="Validated",
                request=request_for(override_holder),
                override_reason="x",
            )


class TestValidate:
    def test_a_pending_job_with_no_failing_rule_ends_validated(self, make_job):
        job, summary = JobService.validate(actor=None, job=make_job())

        assert job.status == "Validated"
        assert job.validation_results["passed"] is True
        assert job.error_message == ""
        assert summary["checked_at"]

    def test_a_blocking_failure_ends_failed(self, make_job):
        PublishValidationRule.objects.create(
            name="Needs a source",
            rule_type="metadata",
            action="block",
            config={"required": ["export_path"]},
        )

        job, summary = JobService.validate(actor=None, job=make_job())

        assert job.status == "Failed"
        assert job.error_message == "Validation failed"
        assert summary["counts"]["failed"] == 1 and summary["passed"] is False

    def test_a_warning_does_not_fail_the_job(self, make_job):
        PublishValidationRule.objects.create(
            name="Prefers a path",
            rule_type="metadata",
            action="warn",
            config={"required": ["export_path"]},
        )

        job, summary = JobService.validate(actor=None, job=make_job())

        assert job.status == "Validated" and summary["counts"]["warning"] == 1

    def test_a_validated_job_can_be_revalidated(self, make_job):
        job, _ = JobService.validate(actor=None, job=make_job())

        again, _ = JobService.validate(actor=None, job=job)

        assert again.status == "Validated"

    @pytest.mark.parametrize(
        "state", ["Validating", "Exporting", "Exported", "Failed", "Cancelled"]
    )
    def test_other_states_are_refused(self, make_job, state):
        with pytest.raises(InvalidTransition):
            JobService.validate(actor=None, job=make_job(state))

    def test_the_audit_row_carries_counts_not_details(self, make_job):
        PublishValidationRule.objects.create(
            name="Secret rule name", rule_type="dependencies", action="error"
        )
        job, _ = JobService.validate(actor=None, job=make_job())

        row = AuditLog.objects.filter(target_id=str(job.pk)).latest("created_at")
        assert row.metadata["not_checked"] == 1
        assert "Secret rule name" not in f"{row.description} {row.metadata}"


class TestRetryCancelRepublishUpdate:
    def test_retry_only_from_failed(self, make_job):
        failed = make_job(
            "Failed",
        )
        PublishItem.objects.filter(pk=failed.pk).update(error_message="boom", retry_count=2)

        retried = JobService.retry(actor=None, job=failed)

        assert (retried.status, retried.error_message, retried.retry_count) == ("Pending", "", 3)
        for state in ("Pending", "Validating", "Validated", "Exporting", "Exported", "Cancelled"):
            with pytest.raises(InvalidTransition):
                JobService.retry(actor=None, job=make_job(state))

    @pytest.mark.parametrize(
        ("state", "allowed"),
        [
            ("Pending", True),
            ("Validating", True),
            ("Validated", True),
            ("Failed", True),
            ("Exporting", False),
            ("Exported", False),
            ("Cancelled", False),
        ],
    )
    def test_cancel(self, make_job, state, allowed):
        job = make_job(state)

        if allowed:
            cancelled = JobService.cancel(actor=None, job=job, reason="  superseded  ")
            assert (cancelled.status, cancelled.cancel_reason) == ("Cancelled", "superseded")
        else:
            with pytest.raises(InvalidTransition):
                JobService.cancel(actor=None, job=job, reason="x")
            assert PublishItem.objects.get(pk=job.pk).status == state

    @pytest.mark.parametrize("state", STATES)
    def test_republish_starts_a_new_job_from_any_status_and_leaves_the_old_one(
        self, make_job, state
    ):
        job = make_job(state)

        new = JobService.republish(actor=None, job=job, comment="try again")

        assert new.pk != job.pk and new.status == "Pending" and new.code != job.code
        assert new.republished_from_id == job.pk  # pyright: ignore[reportAttributeAccessIssue]
        assert PublishItem.objects.get(pk=job.pk).status == state

    @pytest.mark.parametrize("state", sorted(wf.JOB_EDITABLE_STATES))
    def test_update_in_editable_states(self, make_job, state):
        job = make_job(state)

        updated = JobService.update(
            actor=None,
            job=job,
            data={"name": "Renamed", "export_format": "USD", "status": "Exported"},
        )

        assert (updated.name, updated.export_format, updated.status) == ("Renamed", "USD", state)

    @pytest.mark.parametrize("state", sorted(wf.JOB_STATUSES - wf.JOB_EDITABLE_STATES))
    def test_update_is_refused_elsewhere(self, make_job, state):
        with pytest.raises(JobNotEditable):
            JobService.update(actor=None, job=make_job(state), data={"name": "x"})

    def test_an_edit_is_audited_by_field_name_only(self, make_job):
        job = make_job()
        JobService.update(actor=None, job=job, data={"name": "Confidential title"})

        row = AuditLog.objects.filter(target_id=str(job.pk)).latest("created_at")
        assert row.metadata["fields"] == ["name"]
        assert "Confidential" not in f"{row.description} {row.metadata}"

    def test_an_edit_that_changes_nothing_writes_nothing(self, make_job):
        job = make_job()
        before = AuditLog.objects.count()

        JobService.update(actor=None, job=job, data={"name": job.name})

        assert AuditLog.objects.count() == before

    def test_an_unknown_job_is_not_found(self):
        from apps.core.api.exceptions.api import NotFoundException

        with pytest.raises(NotFoundException):
            JobService.retry(actor=None, job="00000000-0000-0000-0000-000000000000")


def test_the_status_of_an_export_job_is_written_in_one_place():
    """No other module assigns ``.status``: every move goes through the workflow service."""
    root = Path(__file__).resolve().parents[2]
    allowed = {"services/workflow.py", "services/files.py"}  # jobs; files (own lifecycle)
    offenders = []
    for path in root.rglob("*.py"):
        relative = path.relative_to(root).as_posix()
        if relative.startswith(("tests/", "migrations/")) or relative in allowed:
            continue
        for number, line in enumerate(path.read_text().splitlines(), 1):
            if re.search(r"\.status\s*=[^=]", line) and not line.lstrip().startswith("#"):
                offenders.append(f"{relative}:{number}")
    assert offenders == []


def test_there_is_no_endpoint_that_moves_many_jobs_at_once():
    """The brief wants bulk endpoints to use the same map; for jobs there are none (file registration is the only bulk route)."""
    from apps.publishing.api.routers import router

    bulk_routes = {
        str(pattern.pattern) for pattern in router.urls if "bulk" in str(pattern.pattern)
    }
    assert all(route.startswith("^files/bulk-register") for route in bulk_routes), bulk_routes
    assert bulk_routes  # the file registration route is there
