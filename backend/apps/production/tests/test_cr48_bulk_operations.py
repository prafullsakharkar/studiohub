"""
CR-48: bulk create and update with a dry run, all-or-nothing batches, code matching and limits.

* ``dry_run: true`` runs every check and write, then rolls them back: nothing is stored, no audit.
* ``atomic: true`` stores nothing when a row fails; every row still says how it fared.
* ``bulk-update`` matches a row by ``id`` or by ``code`` within ``project_id``; parents by code.
* A per-entity whitelist (``bulk_update_fields``) of what bulk-update may change.
* At most 500 items; ``errors: [{row, field, message}]`` beside the per-row ``error``.
* One ``AuditLog`` row per committed batch.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes, grant_permissions
from apps.production.api.viewsets.asset import AssetViewSet
from apps.production.api.viewsets.bulk import BULK_MAX_ITEMS, NOT_BULK_UPDATABLE
from apps.production.api.viewsets.episode import EpisodeViewSet
from apps.production.api.viewsets.sequence import SequenceViewSet
from apps.production.api.viewsets.shot import ShotViewSet
from apps.production.api.viewsets.task import TaskViewSet
from apps.production.models import ProjectMembership, Sequence, Shot
from apps.production.tests.factories import (
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    ShowFactory,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _member(project, *codes, **kwargs):
    user = UserFactory()
    if codes:
        grant_permissions(user, *codes)
    else:
        grant_all_known_codes(user)
    ProjectMembership.objects.create(
        user=user, project=project, status="active", role="Artist", **kwargs
    )
    return user


def _post(client, path, body, status=200):
    response = client.post(f"{API}/{path}", body, format="json")
    assert response.status_code == status, response.content
    return response.json()


def _batches():
    return AuditLog.objects.filter(metadata__operation__startswith="bulk_")


@pytest.fixture
def project():
    return ProjectFactory(workflow_type="standard")


@pytest.fixture
def client(admin_user):
    return _client(admin_user)


def _sequences(project, *codes, **fields):
    return {
        "project_id": str(project.pk),
        "items": [{"code": code, "data": {"name": code.title(), **fields}} for code in codes],
    }


class TestDryRun:
    def test_create_checks_everything_and_stores_nothing(self, client, project):
        body = _post(
            client, "sequences/bulk-create/", {**_sequences(project, "SQA", "SQB"), "dry_run": True}
        )
        assert [row["status"] for row in body["results"]] == ["created", "created"]
        assert body["dry_run"] is True
        assert body["committed"] is False
        assert body["errors"] == []
        # Nothing was stored: no id and no entity to show.
        assert all(row["id"] is None and "entity" not in row for row in body["results"])
        assert not Sequence.all_objects.filter(project=project).exists()
        assert not _batches().exists()

    def test_create_reports_what_would_fail(self, client, project):
        SequenceFactory(project=project, code="SQA")
        body = _post(
            client,
            "sequences/bulk-create/",
            {**_sequences(project, "SQA", "SQB", "SQB"), "dry_run": True},
        )
        assert [row["status"] for row in body["results"]] == ["exists", "created", "duplicate"]
        assert body["errors"] == [
            {"row": 0, "field": "code", "message": "A record with this code already exists."},
            {"row": 2, "field": "code", "message": "Duplicate code within batch."},
        ]
        assert Sequence.all_objects.filter(project=project).count() == 1

    def test_update_previews_the_change_and_keeps_the_row(self, client, project):
        sequence = SequenceFactory(project=project, code="SQA", description="before")
        body = _post(
            client,
            "sequences/bulk-update/",
            {
                "project_id": str(project.pk),
                "dry_run": True,
                "items": [{"code": "sqa", "description": "after"}],
            },
        )
        assert body["results"][0]["status"] == "updated"
        assert body["results"][0]["id"] == str(sequence.pk)
        assert body["results"][0]["entity"]["description"] == "after"
        sequence.refresh_from_db()
        assert sequence.description == "before"
        assert not _batches().exists()

    def test_a_flag_must_be_a_boolean(self, client, project):
        body = _post(
            client,
            "sequences/bulk-create/",
            {**_sequences(project, "SQA"), "dry_run": "maybe"},
            status=400,
        )
        assert "dry_run" in body
        assert not Sequence.all_objects.filter(project=project).exists()


class TestAtomic:
    def test_one_bad_row_stores_nothing(self, client, project):
        payload = _sequences(project, "SQA", "SQB")
        payload["items"].append({"code": "BAD CODE", "data": {}})
        body = _post(client, "sequences/bulk-create/", {**payload, "atomic": True})
        assert [row["status"] for row in body["results"]] == ["created", "created", "invalid"]
        assert body["committed"] is False
        assert body["errors"] == [
            {"row": 2, "field": "code", "message": "A code cannot contain spaces or slashes."}
        ]
        assert not Sequence.all_objects.filter(project=project).exists()
        assert not _batches().exists()

    def test_an_existing_code_fails_the_batch_unless_the_row_says_skip(self, client, project):
        SequenceFactory(project=project, code="SQA")
        payload = _sequences(project, "SQA", "SQB")
        body = _post(client, "sequences/bulk-create/", {**payload, "atomic": True})
        assert body["committed"] is False
        assert not Sequence.all_objects.filter(code="SQB").exists()

        payload["items"][0]["action"] = "skip"
        body = _post(client, "sequences/bulk-create/", {**payload, "atomic": True})
        assert [row["status"] for row in body["results"]] == ["skipped", "created"]
        assert body["committed"] is True
        assert Sequence.objects.filter(project=project, code="SQB").exists()

    def test_a_clean_batch_is_stored_with_one_audit_row(self, client, project, admin_user):
        body = _post(
            client, "sequences/bulk-create/", {**_sequences(project, "SQA", "SQB"), "atomic": True}
        )
        assert body["committed"] is True
        assert all(row["id"] for row in body["results"])
        assert Sequence.objects.filter(project=project).count() == 2
        batch = _batches().get()
        assert batch.action == AuditLog.ACTION_IMPORT
        assert batch.target_type == AuditLog.TARGET_SEQUENCE
        assert batch.target_id == body["operation_id"]
        assert batch.actor_id == admin_user.pk
        assert str(batch.project_id) == str(project.pk)
        assert batch.metadata["counts"] == {
            "total": 2,
            "successful": 2,
            "failed": 0,
            "created": 2,
            "updated": 0,
            "recovered": 0,
            "skipped": 0,
        }
        assert batch.metadata["atomic"] is True

    def test_atomic_update_with_an_unknown_row_changes_nothing(self, client, project):
        sequence = SequenceFactory(project=project, code="SQA", description="before")
        body = _post(
            client,
            "sequences/bulk-update/",
            {
                "project_id": str(project.pk),
                "atomic": True,
                "items": [
                    {"code": "SQA", "description": "after"},
                    {"code": "NOPE", "description": "x"},
                ],
            },
        )
        assert [row["status"] for row in body["results"]] == ["updated", "not_found"]
        assert body["errors"] == [{"row": 1, "field": "id", "message": "Sequence not found."}]
        sequence.refresh_from_db()
        assert sequence.description == "before"


class TestPartial:
    def test_without_flags_good_rows_are_stored_and_bad_ones_reported(self, client, project):
        payload = _sequences(project, "SQA")
        payload["items"].append({"code": "BAD/CODE", "data": {}})
        body = _post(client, "sequences/bulk-create/", payload)
        assert [row["status"] for row in body["results"]] == ["created", "invalid"]
        assert body["committed"] is True
        assert body["dry_run"] is False and body["atomic"] is False
        assert Sequence.objects.filter(project=project, code="SQA").exists()
        assert _batches().get().metadata["counts"]["failed"] == 1

    def test_a_batch_that_writes_nothing_leaves_no_audit_row(self, client, project):
        body = _post(
            client,
            "sequences/bulk-create/",
            {"project_id": str(project.pk), "items": [{"code": "A B"}]},
        )
        assert body["successful"] == 0
        assert not _batches().exists()


class TestLimits:
    def test_more_than_the_limit_is_refused_whole(self, client, project):
        codes = [f"SQ{n:04d}" for n in range(BULK_MAX_ITEMS + 1)]
        body = _post(client, "sequences/bulk-create/", _sequences(project, *codes), status=400)
        assert body["items"] == [f"At most {BULK_MAX_ITEMS} items per request."]
        assert not Sequence.all_objects.filter(project=project).exists()

    def test_the_ids_and_changes_form_is_limited_too(self, client, project):
        ids = [str(SequenceFactory(project=project).pk)] * (BULK_MAX_ITEMS + 1)
        _post(
            client,
            "sequences/bulk-update/",
            {"ids": ids, "changes": {"description": "x"}},
            status=400,
        )

    def test_the_limit_itself_is_accepted(self, client, project):
        codes = [f"SQ{n:04d}" for n in range(BULK_MAX_ITEMS)]
        body = _post(
            client, "sequences/bulk-create/", {**_sequences(project, *codes), "dry_run": True}
        )
        assert body["processed"] == BULK_MAX_ITEMS


class TestMatchByCode:
    def test_update_by_code_within_the_project(self, client, project):
        other = ProjectFactory(workflow_type="standard")
        mine = SequenceFactory(project=project, code="SQA")
        theirs = SequenceFactory(project=other, code="SQA", description="theirs")
        body = _post(
            client,
            "sequences/bulk-update/",
            {"project_id": project.code, "items": [{"code": "sqa", "description": "mine"}]},
        )
        assert body["results"][0]["id"] == str(mine.pk)
        mine.refresh_from_db()
        theirs.refresh_from_db()
        assert (mine.description, theirs.description) == ("mine", "theirs")

    def test_a_code_needs_a_project(self, client, project):
        SequenceFactory(project=project, code="SQA")
        body = _post(
            client, "sequences/bulk-update/", {"items": [{"code": "SQA", "description": "x"}]}
        )
        assert body["errors"] == [
            {"row": 0, "field": "project_id", "message": "Needed to match a row by code."}
        ]

    def test_an_id_and_a_code_of_different_rows_is_a_row_error(self, client, project):
        first = SequenceFactory(project=project, code="SQA", description="orig")
        SequenceFactory(project=project, code="SQB")
        body = _post(
            client,
            "sequences/bulk-update/",
            {"items": [{"id": str(first.pk), "code": "SQB", "description": "x"}]},
        )
        assert body["errors"] == [
            {"row": 0, "field": "code", "message": "The id and the code name different rows."}
        ]
        first.refresh_from_db()
        assert first.description == "orig"

    def test_an_id_from_another_project_than_the_batch_names_is_not_found(self, client, project):
        other = SequenceFactory(project=ProjectFactory(), description="orig")
        body = _post(
            client,
            "sequences/bulk-update/",
            {"project_id": str(project.pk), "items": [{"id": str(other.pk), "description": "x"}]},
        )
        assert body["results"][0]["status"] == "not_found"
        other.refresh_from_db()
        assert other.description == "orig"

    def test_an_unknown_project_reads_like_an_unseen_one(self, client, project):
        body = _post(
            client,
            "sequences/bulk-update/",
            {"project_id": "NOSUCHPROJECT", "items": [{"code": "SQA", "description": "x"}]},
        )
        assert body["results"][0]["status"] == "not_found"


class TestParentsByCode:
    def test_a_shot_names_its_sequence_by_code(self, client, project):
        sequence = SequenceFactory(project=project, code="SQ010")
        body = _post(
            client,
            "shots/bulk-create/",
            {
                "project_id": str(project.pk),
                "atomic": True,
                "items": [{"code": "SH010", "data": {"sequence_id": "sq010"}}],
            },
        )
        assert body["committed"] is True
        assert Shot.objects.get(project=project, code="SH010").sequence_id == sequence.pk

    def test_an_unknown_parent_is_a_row_error_and_nothing_is_stored(self, client, project):
        SequenceFactory(project=project, code="SQ010")
        body = _post(
            client,
            "shots/bulk-create/",
            {
                "project_id": str(project.pk),
                "atomic": True,
                "items": [
                    {"code": "SH010", "data": {"sequence_id": "SQ010"}},
                    {"code": "SH020", "data": {"sequence_id": "SQ999"}},
                ],
            },
        )
        assert [e["row"] for e in body["errors"]] == [1]
        assert body["errors"][0]["field"] == "sequence_id"
        assert not Shot.all_objects.filter(project=project).exists()

    def test_a_parent_of_another_project_reads_as_unknown(self, client, project):
        SequenceFactory(project=ProjectFactory(workflow_type="standard"), code="SQ010")
        body = _post(
            client,
            "shots/bulk-create/",
            {
                "project_id": str(project.pk),
                "items": [{"code": "SH010", "data": {"sequence_id": "SQ010"}}],
            },
        )
        assert body["results"][0]["status"] == "invalid"
        assert body["errors"][0]["field"] == "sequence_id"

    def test_bulk_update_moves_a_shot_to_a_sequence_named_by_code(self, client):
        project = ProjectFactory(workflow_type="episodic")
        episode = EpisodeFactory(project=project, code="EP101")
        first = SequenceFactory(project=project, code="SQ1", episode=episode)
        second = SequenceFactory(project=project, code="SQ2", episode=episode)
        shot = ShotFactory(project=project, code="SH1", sequence=first, episode=episode)
        body = _post(
            client,
            "shots/bulk-update/",
            {
                "project_id": str(project.pk),
                "atomic": True,
                "items": [{"code": "SH1", "sequence_id": "SQ2"}],
            },
        )
        assert body["committed"] is True, body["errors"]
        shot.refresh_from_db()
        assert shot.sequence_id == second.pk


class TestWhitelist:
    @pytest.mark.parametrize(
        "viewset", [EpisodeViewSet, SequenceViewSet, ShotViewSet, AssetViewSet, TaskViewSet]
    )
    def test_every_listed_field_is_a_writable_update_field(self, viewset):
        fields = viewset.serializer_map["partial_update"]().fields
        writable = {name for name, field in fields.items() if not field.read_only}
        assert viewset.bulk_update_fields
        assert set(viewset.bulk_update_fields) <= writable
        assert not {"code", "project", "project_id", "show_id", "client_approved"} & set(
            viewset.bulk_update_fields
        )

    def test_a_field_outside_the_list_refuses_the_row(self, client, project):
        shot = ShotFactory(project=project, client_approved=False, description="orig")
        body = _post(
            client,
            "shots/bulk-update/",
            {"items": [{"id": str(shot.pk), "description": "x", "client_approved": True}]},
        )
        assert body["errors"] == [
            {"row": 0, "field": "client_approved", "message": NOT_BULK_UPDATABLE}
        ]
        shot.refresh_from_db()
        assert (shot.description, shot.client_approved) == ("orig", False)

    def test_a_code_inside_data_is_not_a_rename(self, client, project):
        sequence = SequenceFactory(project=project, code="SQA")
        body = _post(
            client,
            "sequences/bulk-update/",
            {"items": [{"id": str(sequence.pk), "data": {"code": "SQZ"}}]},
        )
        assert body["errors"] == [{"row": 0, "field": "code", "message": NOT_BULK_UPDATABLE}]
        sequence.refresh_from_db()
        assert sequence.code == "SQA"


class TestPermissionsAndScope:
    def test_without_the_update_code_the_request_is_refused(self, project):
        user = _member(project, "sequence.view")
        sequence = SequenceFactory(project=project, description="orig")
        response = _client(user).post(
            f"{API}/sequences/bulk-update/",
            {"items": [{"id": str(sequence.pk), "description": "x"}]},
            format="json",
        )
        assert response.status_code == 403
        sequence.refresh_from_db()
        assert sequence.description == "orig"

    def test_without_the_create_code_the_request_is_refused(self, project):
        user = _member(project, "sequence.view", "sequence.update")
        response = _client(user).post(
            f"{API}/sequences/bulk-create/", _sequences(project, "SQA"), format="json"
        )
        assert response.status_code == 403
        assert not Sequence.all_objects.filter(project=project).exists()

    def test_a_non_member_cannot_create_in_the_project(self, project):
        user = _member(ProjectFactory())
        body = _post(
            _client(user), "sequences/bulk-create/", {**_sequences(project, "SQA"), "atomic": True}
        )
        assert body["results"][0]["status"] == "invalid"
        assert body["committed"] is False
        assert not Sequence.all_objects.filter(project=project).exists()

    def test_a_show_bound_member_matches_only_rows_of_their_show_by_code(self, project):
        show_a, show_b = ShowFactory(project=project), ShowFactory(project=project)
        mine = ShotFactory(project=project, show=show_a, code="SHA", description="orig")
        theirs = ShotFactory(project=project, show=show_b, code="SHB", description="orig")
        client = _client(_member(project, show=show_a))
        body = _post(
            client,
            "shots/bulk-update/",
            {
                "project_id": str(project.pk),
                "items": [{"code": "SHA", "description": "x"}, {"code": "SHB", "description": "x"}],
            },
        )
        assert [row["status"] for row in body["results"]] == ["updated", "not_found"]
        mine.refresh_from_db()
        theirs.refresh_from_db()
        assert (mine.description, theirs.description) == ("x", "orig")

    def test_an_unseen_row_named_by_code_gives_away_no_id_even_when_refused(self, project):
        show_a, show_b = ShowFactory(project=project), ShowFactory(project=project)
        ShotFactory(project=project, show=show_b, code="SHB")
        client = _client(_member(project, show=show_a))
        body = _post(
            client,
            "shots/bulk-update/",
            {"project_id": str(project.pk), "items": [{"code": "SHB", "client_approved": True}]},
        )
        assert body["results"][0]["status"] == "not_found"
        assert body["results"][0]["id"] is None

    def test_a_member_of_another_project_finds_nothing_by_code(self, project):
        sequence = SequenceFactory(project=project, code="SQA", description="orig")
        client = _client(_member(ProjectFactory()))
        body = _post(
            client,
            "sequences/bulk-update/",
            {"project_id": str(project.pk), "items": [{"code": "SQA", "description": "x"}]},
        )
        assert body["results"][0]["status"] == "not_found"
        sequence.refresh_from_db()
        assert sequence.description == "orig"


class TestErrorList:
    def test_the_row_error_stays_and_the_list_names_row_field_and_message(self, client, project):
        sequence = SequenceFactory(project=project)
        body = _post(
            client,
            "sequences/bulk-update/",
            {"items": [{"id": str(sequence.pk), "status": "Nope"}]},
        )
        assert body["results"][0]["error"] == {"status": ['"Nope" is not a valid choice.']}
        assert body["errors"] == [
            {"row": 0, "field": "status", "message": '"Nope" is not a valid choice.'}
        ]

    def test_nested_and_general_errors(self):
        from apps.production.api.viewsets.bulk import flat_errors

        rows = [
            {
                "index": 3,
                "success": False,
                "status": "invalid",
                "error": {"data": {"name": ["Too long."]}, "non_field_errors": ["No."]},
            },
            {
                "index": 4,
                "success": False,
                "status": "invalid",
                "error": "Invalid or missing project.",
            },
            {"index": 5, "success": False, "status": "soft_deleted", "error": None},
            {"index": 6, "success": True, "status": "created"},
        ]
        assert flat_errors(rows) == [
            {"row": 3, "field": "data.name", "message": "Too long."},
            {"row": 3, "field": None, "message": "No."},
            {"row": 4, "field": None, "message": "Invalid or missing project."},
            {
                "row": 5,
                "field": "code",
                "message": "A record with this code is archived: recover it or use another code.",
            },
        ]
