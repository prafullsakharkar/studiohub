"""start-export, complete-export and fail (Q39 B): a pipeline tool reports the export."""

from __future__ import annotations

import pytest

from apps.audit.models import AuditLog
from apps.publishing.constants import workflow as wf
from apps.publishing.models import PublishItem
from apps.publishing.services.jobs import create_job

pytestmark = pytest.mark.django_db

URL = "/api/v1/publishing/"
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
    def build(status="Pending"):
        job = create_job(actor=None, data={**BODY, "project_id": str(project.pk)})
        if status != "Pending":
            PublishItem.objects.filter(pk=job.pk).update(status=status)
        return PublishItem.objects.get(pk=job.pk)

    return build


# action -> (body, the one state it starts from, where it ends)
ACTIONS = {
    "start-export": ({}, "Validated", "Exporting"),
    "complete-export": ({}, "Exporting", "Exported"),
    "fail": ({"reason": "the farm lost the node"}, "Exporting", "Failed"),
}


@pytest.mark.parametrize(
    ("action", "state"), [(a, s) for a in ACTIONS for s in sorted(wf.JOB_STATUSES)]
)
def test_each_action_works_from_its_one_state_and_conflicts_elsewhere(
    staff_client, make_job, action, state
):
    body, start, end = ACTIONS[action]
    job = make_job(state)

    response = staff_client.post(f"{URL}{job.pk}/{action}/", body, format="json")

    if state == start:
        assert response.status_code == 200, response.content
        assert PublishItem.objects.get(pk=job.pk).status == end
    else:
        assert response.status_code == 409
        assert "invalid_transition" in response.content.decode()
        assert PublishItem.objects.get(pk=job.pk).status == state


def test_the_whole_run_a_tool_reports(staff_client, make_job):
    job = make_job()
    assert staff_client.post(f"{URL}{job.pk}/validate/", {}, format="json").status_code == 200
    started = staff_client.post(f"{URL}{job.pk}/start-export/", {}, format="json").json()
    done = staff_client.post(f"{URL}{job.pk}/complete-export/", {}, format="json").json()

    assert (started["job_status"], started["status"]) == ("Exporting", "Publishing")
    assert (done["job_status"], done["status"]) == ("Exported", "Published")


def test_a_failed_export_keeps_the_reason_and_can_be_retried(staff_client, make_job):
    job = make_job("Exporting")

    failed = staff_client.post(
        f"{URL}{job.pk}/fail/", {"reason": "  out of disk  "}, format="json"
    ).json()
    retried = staff_client.post(f"{URL}{job.pk}/retry/", {}, format="json").json()

    assert (failed["job_status"], failed["error_message"]) == ("Failed", "out of disk")
    assert (retried["job_status"], retried["error_message"]) == ("Pending", "")


@pytest.mark.parametrize("body", [{}, {"reason": ""}, {"reason": "   "}])
def test_fail_needs_a_reason(staff_client, make_job, body):
    job = make_job("Exporting")

    assert staff_client.post(f"{URL}{job.pk}/fail/", body, format="json").status_code == 400
    assert PublishItem.objects.get(pk=job.pk).status == "Exporting"


def test_a_finished_export_is_final(staff_client, make_job):
    job = make_job("Exporting")
    staff_client.post(f"{URL}{job.pk}/complete-export/", {}, format="json")

    assert staff_client.post(f"{URL}{job.pk}/unpublish/", {}, format="json").status_code == 409
    assert staff_client.patch(f"{URL}{job.pk}/", {"name": "x"}, format="json").status_code == 409


def test_each_report_is_audited_without_the_reason_text(staff_client, make_job):
    job = make_job("Exporting")
    staff_client.post(f"{URL}{job.pk}/fail/", {"reason": "customer-secret-detail"}, format="json")

    row = AuditLog.objects.filter(target_id=str(job.pk), target_type="publishing").latest(
        "created_at"
    )
    assert row.metadata["to"] == "Failed" and row.metadata["reason_given"] is True
    assert "customer-secret-detail" not in f"{row.description} {row.metadata}"


def test_job_status_is_the_stored_word_beside_the_frontends(staff_client, make_job):
    """Q15 A: ``status`` keeps the frontend's words; ``job_status`` is the real one."""
    for stored, shown in [
        ("Pending", "Queued"),
        ("Validated", "Published"),
        ("Exporting", "Publishing"),
    ]:
        job = make_job(stored)

        detail = staff_client.get(f"{URL}{job.pk}/").json()
        listed = next(
            row for row in staff_client.get(URL).json()["results"] if row["id"] == str(job.pk)
        )

        assert (detail["status"], detail["job_status"]) == (shown, stored)
        assert (listed["status"], listed["job_status"]) == (shown, stored)


def test_job_status_cannot_be_written(staff_client, make_job):
    job = make_job()

    response = staff_client.patch(f"{URL}{job.pk}/", {"job_status": "Exported"}, format="json")

    assert response.status_code == 200  # an unknown key is ignored, as before
    assert PublishItem.objects.get(pk=job.pk).status == "Pending"
