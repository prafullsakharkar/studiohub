# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""Export jobs: server-made codes, project and version links, republish lineage (DOM-PUB-05)."""

from __future__ import annotations

import pytest
from rest_framework.exceptions import ValidationError

from apps.production.tests.factories import ProjectFactory, ShotFactory
from apps.publishing.models import PublishCounter, PublishItem
from apps.publishing.services.jobs import allocate_code, create_job, next_republish_code
from apps.publishing.services.publish import republish, unpublish
from apps.publishing.tests.helpers import published_version

pytestmark = pytest.mark.django_db

BODY = {
    "name": "Hero rig export",
    "entity_type": "Shot",
    "entity_id": "not-checked-here",
    "entity_code": "SH010",
    "entity_name": "Opening shot",
    "dcc_tool": "Maya",
    "source_file": "work/a.ma",
}


def _job(user=None, **over):
    return create_job(actor=user, data={**BODY, **over})


class TestCodes:
    def test_a_blank_code_is_numbered_from_the_project(self, project):
        first = _job(project_id=str(project.pk))
        second = _job(project_id=str(project.pk), code="")

        assert (first.code, second.code) == ("PUB-PUBP-0001", "PUB-PUBP-0002")
        assert PublishCounter.objects.get(project_id=project.pk).last_number == 2

    def test_projects_count_separately_and_the_project_may_be_named_by_code(self, project):
        other = ProjectFactory.create(code="PUBQ")

        assert _job(project_id="PUBP").code == "PUB-PUBP-0001"
        assert _job(project_id=str(other.pk)).code == "PUB-PUBQ-0001"
        assert _job(project_id="pubp").code == "PUB-PUBP-0002"

    def test_a_blank_code_without_a_project_is_refused(self):
        with pytest.raises(ValidationError) as error:
            _job()
        assert "code" in error.value.detail

    def test_a_code_that_is_sent_is_kept(self, project):
        job = _job(code="MY-CODE-1", project_id=str(project.pk))
        assert job.code == "MY-CODE-1"
        assert PublishCounter.objects.count() == 0

    @pytest.mark.parametrize("again", ["MY-CODE-1", "my-code-1", "My-Code-1"])
    def test_a_used_code_is_refused_in_any_case(self, again):
        _job(code="MY-CODE-1")

        with pytest.raises(ValidationError) as error:
            _job(code=again)
        assert error.value.detail == {"code": ["This code is already used."]}

    def test_a_soft_deleted_jobs_code_stays_taken(self):
        job = _job(code="GONE-1")
        job.is_deleted = True
        job.save()

        with pytest.raises(ValidationError):
            _job(code="gone-1")

    def test_a_number_whose_code_is_taken_is_skipped(self, project):
        _job(code="pub-pubp-0001")  # hand-typed, same shape as the first server code

        assert allocate_code(project) == "PUB-PUBP-0002"

    def test_the_database_refuses_a_duplicate_code_in_any_case(self):
        from django.db import IntegrityError, transaction

        _job(code="DUP-1")
        with pytest.raises(IntegrityError), transaction.atomic():
            PublishItem.objects.create(
                name="x", code="dup-1", entity_type="Shot", entity_id="1", entity_code="a",
                entity_name="b", dcc_tool="Maya", source_file="s",
            )  # fmt: skip


class TestLinks:
    def test_an_unknown_project_is_a_400_not_a_500(self):
        for value in ("00000000-0000-0000-0000-000000000000", "NOPE", "not a uuid"):
            with pytest.raises(ValidationError) as error:
                _job(project_id=value, code="X-1")
            assert error.value.detail == {"project_id": ["Unknown project."]}

    def test_a_version_supplies_the_project_and_the_shot(self, project):
        shot = ShotFactory.create(project=project, code="SH020")
        version = published_version(project, shot=shot)

        job = create_job(
            actor=None,
            data={
                "name": "n",
                "dcc_tool": "Maya",
                "version_id": str(version.pk),
                "source_file": "a",
            },
        )

        assert job.version_id == version.pk
        assert job.project_id == project.pk
        assert (job.entity_type, job.entity_code, job.entity_id) == ("Shot", "SH020", str(shot.pk))
        assert job.code == "PUB-PUBP-0001"

    def test_a_body_that_disagrees_with_the_version_is_refused(self, project):
        version = published_version(project, shot=ShotFactory.create(project=project, code="SH030"))

        with pytest.raises(ValidationError) as error:
            _job(version_id=str(version.pk), entity_code="SH999")
        assert "entity_code" in error.value.detail

    def test_a_version_of_another_project_is_refused(self, project):
        version = published_version(ProjectFactory.create(code="PUBZ"))

        with pytest.raises(ValidationError) as error:
            _job(version_id=str(version.pk), project_id=str(project.pk), code="X-2")
        assert error.value.detail == {"version_id": ["Unknown version."]}

    @pytest.mark.parametrize("value", ["00000000-0000-0000-0000-000000000000", "nope"])
    def test_an_unknown_version_is_refused(self, value):
        with pytest.raises(ValidationError) as error:
            _job(version_id=value, code="X-3")
        assert error.value.detail == {"version_id": ["Unknown version."]}

    def test_entity_fields_are_required_without_a_shot_version(self, project):
        with pytest.raises(ValidationError) as error:
            create_job(
                actor=None, data={"name": "n", "dcc_tool": "Maya", "project_id": str(project.pk)}
            )
        assert {"entity_type", "entity_id", "entity_code", "entity_name"} <= set(error.value.detail)

    def test_the_project_cannot_be_deleted_while_jobs_exist(self, project):
        from django.db.models import ProtectedError

        _job(project_id=str(project.pk))

        with pytest.raises(ProtectedError):
            type(project).all_objects.filter(pk=project.pk).delete()


class TestRepublish:
    def test_republishing_twice_gives_distinct_codes(self, project):
        """PUB-07: two republishes used to give two rows with the same code."""
        job = _job(project_id=str(project.pk))

        one = republish(publish_id=str(job.pk), user_id=None)
        two = republish(publish_id=str(job.pk), user_id=None)

        assert len({job.code, one.code, two.code}) == 3
        assert (one.republished_from_id, two.republished_from_id) == (job.pk, job.pk)

    def test_a_job_with_no_project_gets_a_derived_free_code(self):
        job = _job(code="OLD-1")
        PublishItem.objects.create(
            name="x", code="OLD-1_v2", entity_type="Shot", entity_id="1", entity_code="a",
            entity_name="b", dcc_tool="Maya", source_file="s",
        )  # fmt: skip

        assert next_republish_code(job) == "OLD-1_v3"

    def test_the_version_link_is_carried(self, project):
        version = published_version(project, shot=ShotFactory.create(project=project, code="SH040"))
        job = create_job(
            actor=None,
            data={
                "name": "n",
                "dcc_tool": "Maya",
                "version_id": str(version.pk),
                "source_file": "a",
            },
        )

        assert republish(publish_id=str(job.pk), user_id=None).version_id == version.pk


def test_unpublish_cancels_without_writing_the_deprecated_archive_flag(project):
    job = _job(project_id=str(project.pk))

    unpublish(publish_id=str(job.pk), user_id=None)

    job.refresh_from_db()
    assert (job.status, job.is_archived) == ("Cancelled", False)
