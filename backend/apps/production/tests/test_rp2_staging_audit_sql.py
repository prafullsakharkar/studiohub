"""
RP-2 WP 2.6: ``docs/review-pipeline/STAGING_AUDIT_RP2.sql`` runs on the real schema, changes nothing,
and says of each note exactly what migration 0006 then does with it.
"""

from __future__ import annotations

import importlib
import uuid
from pathlib import Path

import pytest
from django.apps import apps as django_apps
from django.db import connection

from apps.production.models import ProjectNote, ProjectNoteLink
from apps.production.tests.factories import (
    AssetFactory,
    EpisodeFactory,
    ProjectFactory,
    ShotFactory,
    TaskFactory,
)

pytestmark = [
    pytest.mark.django_db,
    pytest.mark.skipif(connection.vendor != "postgresql", reason="the audit SQL is PostgreSQL's"),
]

SQL = Path(__file__).resolve().parents[4] / "docs" / "review-pipeline" / "STAGING_AUDIT_RP2.sql"


def _blocks() -> tuple[str, str]:
    text = SQL.read_text()
    first = text.index("-- 1. ")
    second = text.index("-- 2. ")
    return text[first:second], text[second:]


def _run(sql: str):
    with connection.cursor() as cursor:
        cursor.execute(sql)
        names = [col.name for col in cursor.description]
        return [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]


def test_it_says_what_the_migration_does():
    project = ProjectFactory.create(code="RPAUD")
    other = ProjectFactory.create(code="RPAUDX")
    episodic = ProjectFactory.create(code="RPAUDE", workflow_type="episodic")
    shot = ShotFactory.create(project=project)
    archived = AssetFactory.create(project=project)
    archived.delete()
    episode = EpisodeFactory.create(project=episodic)
    foreign = ShotFactory.create(project=other)

    def note(entity_type, entity_id, on=project, deleted=False):
        row = ProjectNote.objects.create(
            project=on, subject="s", entity_type=entity_type, entity_id=entity_id
        )
        if deleted:
            row.delete()
        return row

    linked = [
        note("Shot", str(shot.id)),
        note("shot", str(shot.id).replace("-", "").upper()),
        note("Asset", str(archived.id)),
        note("Episode", str(episode.id), on=episodic),
        note("Shot", str(shot.id), deleted=True),
    ]
    unlinked = {
        "type cannot be linked": [note("Task", str(TaskFactory.create(project=project).id))],
        "id is not a UUID": [note("Shot", "SH010"), note("Shot", "")],
        "no such record in the note's project": [
            note("Shot", str(foreign.id)),
            note("Shot", str(uuid.uuid4())),
        ],
    }
    on_project = [note("Project", str(project.id)), note("", "")]
    count, listing = _blocks()

    counts = {row["outcome"]: (row["notes"], row["of_them_archived"]) for row in _run(count)}
    listed = {str(row["id"]): row["outcome"] for row in _run(listing)}

    assert counts == {
        "will be linked": (5, 1),
        "on the project (no record named)": (2, 0),
        "type cannot be linked": (1, 0),
        "id is not a UUID": (2, 0),
        "no such record in the note's project": (2, 0),
    }
    assert listed == {str(n.pk): outcome for outcome, rows in unlinked.items() for n in rows}
    assert not ProjectNoteLink.objects.exists()  # the SQL wrote nothing

    module = importlib.import_module("apps.production.migrations.0006_rp2_backfill_note_links")
    module.backfill(django_apps, None)

    with_links = set(ProjectNoteLink.objects.values_list("note_id", flat=True))
    assert with_links == {n.pk for n in linked}
    assert not with_links & {n.pk for n in on_project}
