"""
Honest validation (Q14): a rule says ``passed`` only for what the server checked.
"""

from __future__ import annotations

import pytest

from apps.production.models import Version
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import PublishedFile, PublishItem, PublishValidationRule
from apps.publishing.services import validation
from apps.publishing.services.files import PublishedFileService
from apps.publishing.services.jobs import create_job
from apps.publishing.tests.helpers import (
    member,
    published_version,
    registration,
    request_for,
)

pytestmark = pytest.mark.django_db

BODY = {
    "name": "Rig export",
    "entity_type": "Shot",
    "entity_id": "x",
    "entity_code": "SH010",
    "entity_name": "Opening",
    "dcc_tool": "Maya",
    "source_file": "work/a.ma",
    "export_format": "USD",
}


def rule(rule_type, action="error", config=None, **extra):
    return PublishValidationRule.objects.create(
        name=extra.pop("name", f"{rule_type} rule"),
        rule_type=rule_type,
        action=action,
        config=config or {},
        **extra,
    )


@pytest.fixture
def job(project):
    return create_job(actor=None, data={**BODY, "project_id": str(project.pk)})


@pytest.fixture
def add_file(project, root, job):
    user = member(project, P.CREATE)
    version = published_version(project)

    def go(path, state=None, **over):
        file, _ = PublishedFileService.register(
            actor=user,
            request=request_for(user),
            version_id=version.pk,
            data=registration(version, root, path, export_job_id=str(job.pk), **over),
        )
        if state:
            PublishedFileService.record_verification(file_id=file.pk, state=state)
        return PublishedFile.objects.get(pk=file.pk)

    return go


def run(job):
    results = validation.evaluate(PublishItem.objects.get(pk=job.pk))
    return {r.rule_type: r for r in results}


class TestMetadata:
    def test_passes_when_the_default_details_are_present(self, job):
        rule("metadata")

        assert run(job)["metadata"].status == "passed"

    def test_fails_naming_what_is_missing(self, job):
        rule("metadata", config={"required": ["export_path", "dcc_version"]})

        result = run(job)["metadata"]

        assert result.status == "failed"
        assert "export_path" in result.message and "dcc_version" in result.message

    def test_a_warn_rule_warns_instead_of_failing(self, job):
        rule("metadata", action="warn", config={"required": ["export_path"]})

        assert run(job)["metadata"].status == "warning"


class TestFormat:
    def test_no_allowed_list_means_not_checked(self, job):
        rule("file_format")

        assert run(job)["file_format"].status == "not_checked"

    def test_an_allowed_format_passes_in_any_case(self, job):
        rule("file_format", config={"allowed_formats": ["usd", "ABC"]})

        assert run(job)["file_format"].status == "passed"

    def test_another_format_fails(self, job):
        rule("file_format", config={"allowed_formats": ["FBX"]})

        assert run(job)["file_format"].status == "failed"

    def test_an_undeclared_format_fails_rather_than_passes(self, job):
        PublishItem.objects.filter(pk=job.pk).update(export_format="")
        rule("file_format", config={"allowed_formats": ["USD"]})

        assert run(job)["file_format"].status == "failed"


class TestSize:
    def test_no_limit_means_not_checked(self, job):
        rule("file_size")

        assert run(job)["file_size"].status == "not_checked"

    @pytest.mark.parametrize("limit", [-1, "big", True, None, 1.5])
    def test_an_unusable_limit_is_not_checked(self, job, add_file, limit):
        add_file("s/a.exr")
        rule("file_size", config={"max_bytes": limit})

        assert run(job)["file_size"].status == "not_checked"

    def test_no_files_means_not_checked(self, job):
        rule("file_size", config={"max_bytes": 10})

        result = run(job)["file_size"]

        assert result.status == "not_checked" and "No files" in result.message

    def test_within_and_over_the_limit(self, job, add_file):
        add_file("s/a.exr", size_bytes=100)
        within = rule("file_size", config={"max_bytes": 100})
        assert run(job)["file_size"].status == "passed"

        within.delete()
        add_file("s/b.exr", size_bytes=101)
        rule("file_size", config={"max_bytes": 100})
        assert run(job)["file_size"].status == "failed"


class TestFrameRange:
    def test_no_sequence_means_not_checked(self, job, add_file):
        add_file("s/a.exr")
        rule("frame_range")

        assert run(job)["frame_range"].status == "not_checked"

    def test_a_job_without_a_version_range_is_not_checked(self, job, add_file):
        add_file("s/a.%04d.exr", frame_start=1001, frame_end=1100)
        rule("frame_range")

        assert run(job)["frame_range"].status == "not_checked"

    def test_matching_and_differing_ranges(self, project, add_file, job):
        version = published_version(project)
        Version.objects.filter(pk=version.pk).update(start_frame=1001, end_frame=1100)
        PublishItem.objects.filter(pk=job.pk).update(version=version)
        add_file("s/a.%04d.exr", frame_start=1001, frame_end=1100)
        rule("frame_range")
        assert run(job)["frame_range"].status == "passed"

        add_file("s/b.%04d.exr", frame_start=1001, frame_end=1090)
        assert run(job)["frame_range"].status == "failed"


class TestFilesExist:
    def test_no_files_means_not_checked(self, job):
        rule("file_exists")

        assert run(job)["file_exists"].status == "not_checked"

    def test_registered_but_unverified_is_not_checked_not_passed(self, job, add_file):
        add_file("s/a.exr")
        rule("file_exists")

        result = run(job)["file_exists"]

        assert result.status == "not_checked" and "not verified" in result.message

    def test_all_verified_passes(self, job, add_file):
        add_file("s/a.exr", state="verified")
        add_file("s/b.exr", state="verified")
        rule("file_exists")

        assert run(job)["file_exists"].status == "passed"

    @pytest.mark.parametrize("state", ["missing", "mismatch"])
    def test_a_file_known_to_be_wrong_fails(self, job, add_file, state):
        add_file("s/a.exr", state="verified")
        add_file("s/b.exr", state=state)
        rule("file_exists")

        assert run(job)["file_exists"].status == "failed"

    def test_a_revoked_file_is_not_counted(self, project, job, add_file):
        bad = add_file("s/bad.exr", state="missing")
        PublishedFile.all_objects.filter(pk=bad.pk).update(status="Revoked", revoke_reason="x")
        add_file("s/good.exr", state="verified")
        rule("file_exists")

        assert run(job)["file_exists"].status == "passed"


class TestTheRest:
    @pytest.mark.parametrize("rule_type", ["dependencies", "permissions"])
    def test_rules_the_server_cannot_check_say_so(self, job, rule_type):
        rule(rule_type)

        assert run(job)[rule_type].status == "not_checked"

    def test_inactive_rules_are_ignored_and_the_order_is_kept(self, job):
        rule("metadata", name="second", order=2)
        rule("file_format", name="first", order=1)
        rule("dependencies", name="off", is_active=False)

        assert [r.rule_name for r in validation.evaluate(job)] == ["first", "second"]


class TestSummary:
    def test_not_checked_rules_do_not_count_as_passed(self, job):
        rule("metadata")
        rule("dependencies")
        rule("permissions")

        summary = validation.summarize(validation.evaluate(job))

        assert summary["counts"] == {"passed": 1, "failed": 0, "warning": 0, "not_checked": 2}
        assert summary["passed"] is True  # nothing blocking failed
        by_type = {r["rule_type"]: r for r in summary["results"]}
        assert by_type["metadata"]["passed"] is True
        assert by_type["dependencies"]["passed"] is None  # not "True": it was never checked

    def test_a_failure_makes_the_summary_fail(self, job):
        rule("metadata", config={"required": ["export_path"]})

        summary = validation.summarize(validation.evaluate(job))

        assert summary["passed"] is False
        assert summary["results"][0]["passed"] is False

    def test_a_job_with_no_rules_has_nothing_to_report(self, job):
        summary = validation.summarize(validation.evaluate(job))

        assert summary["passed"] is True and summary["results"] == []
