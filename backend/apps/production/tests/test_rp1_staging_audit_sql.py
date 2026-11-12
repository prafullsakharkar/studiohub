"""
docs/review-pipeline/STAGING_AUDIT.sql (RP-1 WP 1.6) must be valid, read-only SQL for the current schema,
and must report what is in the six version columns before they are dropped.

It is run by hand on staging and production, so every statement is executed here against the test
database to catch a wrong table or column name, and checked to be SELECT-only.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from django.db import connection

from apps.production.models import Version
from apps.production.services.playlist import PlaylistService
from apps.production.tests.factories import (
    PlaylistFactory,
    ProjectFactory,
    ShotFactory,
    VersionFactory,
)

pytestmark = pytest.mark.skipif(connection.vendor != "postgresql", reason="uses PostgreSQL syntax")

SQL = Path(__file__).resolve().parents[4] / "docs" / "review-pipeline" / "STAGING_AUDIT.sql"
COLUMNS = ("media_items", "attachments", "reviews", "playlists", "notes_list", "activity")


def _statements():
    text = "\n".join(
        line for line in SQL.read_text().splitlines() if not line.lstrip().startswith("--")
    )
    return [part.strip() for part in text.split(";") if part.strip()]


def _run(statement):
    with connection.cursor() as cursor:
        cursor.execute(statement)
        return cursor.fetchall()


def test_the_file_has_the_count_the_samples_and_the_playlist_check():
    statements = _statements()
    assert len(statements) == 8  # 1, 2a-2f, 3
    for column in COLUMNS:
        assert f"'{column}'" in statements[0]
        assert any(f"v.{column} IS NOT NULL" in s for s in statements[1:7]), column


@pytest.mark.django_db
def test_every_statement_is_a_select_and_runs():
    for statement in _statements():
        assert statement.upper().startswith("SELECT"), statement[:60]
        assert not re.search(
            r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT)\b", statement, re.I
        )
        _run(statement)


@pytest.mark.django_db
def test_it_reports_what_the_columns_hold():
    project = ProjectFactory.create(code="RPAUDIT")
    shot = ShotFactory.create(project=project, code="RPAUDIT_S1")
    held, by_name, archived = (
        VersionFactory.create(project=project, shot=shot, code=f"RPAUDIT_V{n}", version_index=n + 1)
        for n in range(3)
    )
    playlist = PlaylistFactory.create(project=project, code="RPAUDIT_PL")
    entry = PlaylistService.add_entry(user=None, playlist=playlist, version_ref=held.id)
    Version.all_objects.filter(pk=held.pk).update(
        playlists=[{"playlist_id": str(playlist.id), "playlist_name": playlist.name}],
        notes_list=[{"text": "typed by someone"}],
        activity=[{"action": "created"}],
    )
    Version.all_objects.filter(pk=by_name.pk).update(
        playlists=[{"playlist_id": None, "playlist_name": "Fresh"}]
    )
    Version.all_objects.filter(pk=archived.pk).update(activity={"not": "a list"}, is_deleted=True)
    statements = _statements()

    counts = {row[0]: row[1:] for row in _run(statements[0])}
    assert counts["playlists"] == (2, 0, 0)
    assert counts["notes_list"] == (1, 0, 0)
    assert counts["activity"] == (2, 1, 1)  # two hold some, one of them archived and not a list
    assert counts["media_items"] == (0, 0, 0)

    notes = next(s for s in statements[1:7] if "v.notes_list IS NOT NULL" in s)
    (row,) = _run(notes)
    assert row[2] == "RPAUDIT_V0" and row[4] == 1 and "typed by someone" in row[5]

    # only the add by name has no live entry behind it; the held one has
    assert [(r[1], r[2], r[3]) for r in _run(statements[7])] == [("RPAUDIT_V1", None, "Fresh")]
    # once the version is taken off the playlist, its copy no longer has an entry behind it either
    PlaylistService.remove_entry(user=None, playlist=playlist, ref=str(entry.pk))
    assert {r[1] for r in _run(statements[7])} == {"RPAUDIT_V0", "RPAUDIT_V1"}
