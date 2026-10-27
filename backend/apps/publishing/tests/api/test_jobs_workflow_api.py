"""Export job endpoints after Phase 4 (API-PUB-03 to API-PUB-07): PATCH works, moves follow the map."""

from __future__ import annotations

import pytest

from apps.audit.models import AuditLog
from apps.publishing.constants import workflow as wf
from apps.publishing.models import PublishItem, PublishValidationRule
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


def _status(job):
    return PublishItem.objects.get(pk=job.pk).status


class TestEdit:
    def test_patch_edits_details_and_answers_with_the_detail_shape(self, staff_client, make_job):
        job = make_job()

        response = staff_client.patch(
            f"{URL}{job.pk}/", {"name": "New name", "export_format": "USD"}, format="json"
        )

        assert response.status_code == 200
        body = response.json()
        assert (body["name"], body["export_format"], body["code"]) == ("New name", "USD", job.code)
        assert "validation_results" in body  # the detail shape

    def test_put_works_too(self, staff_client, make_job):
        job = make_job()

        assert (
            staff_client.put(f"{URL}{job.pk}/", {"name": "Via PUT"}, format="json").status_code
            == 200
        )

    def test_it_is_audited_without_the_new_values(self, staff_client, make_job):
        job = make_job()
        staff_client.patch(f"{URL}{job.pk}/", {"name": "Hush-hush title"}, format="json")

        row = AuditLog.objects.filter(target_id=str(job.pk), target_type="publishing").latest(
            "created_at"
        )
        assert "Hush-hush" not in f"{row.description} {row.metadata}"

    @pytest.mark.parametrize(
        ("field", "value"),
        [("status", "Exported"), ("code", "OTHER-1"), ("is_archived", True), ("retry_count", 9)],
    )
    def test_the_status_code_archive_flag_and_retry_count_cannot_be_written(
        self, staff_client, make_job, field, value
    ):
        job = make_job()

        response = staff_client.patch(f"{URL}{job.pk}/", {field: value}, format="json")

        assert response.status_code == 400
        assert "Cannot be set directly" in response.content.decode()
        fresh = PublishItem.objects.get(pk=job.pk)
        assert (fresh.status, fresh.code, fresh.is_archived, fresh.retry_count) == (
            "Pending", job.code, False, 0,
        )  # fmt: skip

    def test_an_echo_of_the_current_values_is_accepted(self, staff_client, make_job):
        """A full PUT sends back what it read; the status it read is the API's word ("Queued")."""
        job = make_job()
        read = staff_client.get(f"{URL}{job.pk}/").json()

        response = staff_client.put(f"{URL}{job.pk}/", read, format="json")

        assert response.status_code == 200, response.content
        assert PublishItem.objects.get(pk=job.pk).status == "Pending"

    def test_the_raw_status_is_an_echo_too(self, staff_client, make_job):
        job = make_job()

        assert (
            staff_client.patch(f"{URL}{job.pk}/", {"status": "Pending"}, format="json").status_code
            == 200
        )

    @pytest.mark.parametrize("state", sorted(wf.JOB_STATUSES - wf.JOB_EDITABLE_STATES))
    def test_a_job_that_has_moved_on_cannot_be_edited(self, staff_client, make_job, state):
        job = make_job(state)

        response = staff_client.patch(f"{URL}{job.pk}/", {"name": "x"}, format="json")

        assert response.status_code == 409
        assert "job_not_editable" in response.content.decode()

    @pytest.mark.parametrize("state", sorted(wf.JOB_EDITABLE_STATES))
    def test_a_pending_or_failed_job_can(self, staff_client, make_job, state):
        assert (
            staff_client.patch(
                f"{URL}{make_job(state).pk}/", {"name": "x"}, format="json"
            ).status_code
            == 200
        )

    def test_a_bad_tool_is_a_400(self, staff_client, make_job):
        assert (
            staff_client.patch(
                f"{URL}{make_job().pk}/", {"dcc_tool": "Paint"}, format="json"
            ).status_code
            == 400
        )

    def test_it_needs_the_update_code(self, make_job, project):
        from apps.publishing.constants.permissions import PublishPermissions as P
        from apps.publishing.tests.helpers import client_for, member

        viewer = client_for(member(project, P.VIEW, P.CREATE))

        assert (
            viewer.patch(f"{URL}{make_job().pk}/", {"name": "x"}, format="json").status_code == 403
        )


class TestActions:
    # action -> the states it works from (everything else is 409)
    ALLOWED = {
        "validate": {"Pending", "Validated"},
        "retry": {"Failed"},
        "unpublish": {"Pending", "Validating", "Validated", "Failed"},
    }

    @pytest.mark.parametrize(
        ("action", "state"),
        [(a, s) for a in ALLOWED for s in sorted(wf.JOB_STATUSES)],
    )
    def test_each_action_works_from_its_states_and_conflicts_elsewhere(
        self, staff_client, make_job, action, state
    ):
        job = make_job(state)

        response = staff_client.post(f"{URL}{job.pk}/{action}/", {}, format="json")

        if state in self.ALLOWED[action]:
            assert response.status_code == 200, response.content
        else:
            assert response.status_code == 409, (action, state, response.status_code)
            assert "invalid_transition" in response.content.decode()
            assert _status(job) == state

    @pytest.mark.parametrize("state", sorted(wf.JOB_STATUSES))
    def test_republish_works_from_any_state(self, staff_client, make_job, state):
        job = make_job(state)

        response = staff_client.post(
            f"{URL}{job.pk}/republish/", {"comment": "again"}, format="json"
        )

        assert response.status_code == 201
        assert _status(job) == state

    def test_retry_on_a_job_that_did_not_fail_is_a_409_not_a_500(self, staff_client, make_job):
        assert (
            staff_client.post(f"{URL}{make_job().pk}/retry/", {}, format="json").status_code == 409
        )

    def test_retry_clears_the_error_and_reads_as_queued(self, staff_client, make_job):
        job = make_job("Failed")
        PublishItem.objects.filter(pk=job.pk).update(error_message="boom")

        body = staff_client.post(f"{URL}{job.pk}/retry/", {}, format="json").json()

        assert (body["status"], body["error_message"]) == ("Queued", "")

    def test_unpublish_stores_the_reason_and_ignores_the_user_name(self, staff_client, make_job):
        job = make_job("Validated")

        response = staff_client.post(
            f"{URL}{job.pk}/unpublish/",
            {"reason": "wrong shot", "user_name": "Mallory"},
            format="json",
        )

        assert response.status_code == 200
        fresh = PublishItem.objects.get(pk=job.pk)
        assert (fresh.status, fresh.cancel_reason, fresh.is_archived) == (
            "Cancelled",
            "wrong shot",
            False,
        )
        assert response.json()["status"] == "Unpublished"  # the word the frontend knows

    def test_unpublishing_twice_is_a_409(self, staff_client, make_job):
        job = make_job()
        assert staff_client.post(f"{URL}{job.pk}/unpublish/", {}, format="json").status_code == 200
        assert staff_client.post(f"{URL}{job.pk}/unpublish/", {}, format="json").status_code == 409


class TestValidateAnswer:
    def test_it_keeps_its_old_keys_and_adds_the_rule_statuses(self, staff_client, make_job):
        PublishValidationRule.objects.create(name="Metadata", rule_type="metadata", action="error")
        PublishValidationRule.objects.create(name="Deps", rule_type="dependencies", action="error")
        job = make_job()

        body = staff_client.post(f"{URL}{job.pk}/validate/", {}, format="json").json()

        assert body["success"] is True and body["all_passed"] is True
        assert (
            body["status"] == "Published"
        )  # Validated, in the frontend's words (Q15: kept for now)
        statuses = {r["rule_type"]: r["status"] for r in body["validation_results"]}
        assert statuses == {"metadata": "passed", "dependencies": "not_checked"}
        assert body["counts"] == {"passed": 1, "failed": 0, "warning": 0, "not_checked": 1}
        assert PublishItem.objects.get(pk=job.pk).validation_results["counts"]["not_checked"] == 1

    def test_a_blocking_rule_fails_the_job(self, staff_client, make_job):
        PublishValidationRule.objects.create(
            name="Path", rule_type="metadata", action="block", config={"required": ["export_path"]}
        )
        job = make_job()

        body = staff_client.post(f"{URL}{job.pk}/validate/", {}, format="json").json()

        assert (body["status"], body["all_passed"]) == ("Failed", False)
        assert _status(job) == "Failed"

    def test_validating_an_unpublished_job_no_longer_says_published(self, staff_client, make_job):
        """PUB-06: it used to answer "Published" while the job stayed cancelled."""
        job = make_job("Cancelled")

        assert staff_client.post(f"{URL}{job.pk}/validate/", {}, format="json").status_code == 409
        assert _status(job) == "Cancelled"
