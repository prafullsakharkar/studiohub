"""
Phase 5 sample capture: projects, shows, episodes, sequences, editorial tracks, project members and the
project-scoped read views (docs/sync).

Real MFA-enrolled superuser JWT flow; every call is recorded whatever its status, so failures (the
interesting part of a contract) are data, not errors. Pytest test database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_production_structure.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_capture_identity_admin import FLOW, call, redact, sign_in_plain, sign_in_with_mfa  # noqa: E402

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])


@pytest.mark.django_db
def test_capture_production_structure(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.models import Role, UserRole
    from apps.identity.tests.mfa_helpers import enable_mfa

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase5!9")
    enable_mfa(admin)
    artist = U.create_user(email="artist@example.test", password="Artist-Pass-Phase5!9")
    artist.is_active = True
    artist.save()
    UserRole.objects.create(user=artist, role=Role.objects.get(code="artist"))
    outsider = U.create_user(email="outsider@example.test", password="Outsider-Pass-Phase5!9")
    outsider.is_active = True
    outsider.save()

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase5!9", admin)

    # ------------------------------------------------------------ projects
    call(a, "projects_create_empty", "POST", "/api/v1/projects/", {})
    p = call(a, "projects_create", "POST", "/api/v1/projects/", {"code": "ALPHA", "name": "Alpha", "type": "Episodic Series", "workflow_type": "episodic", "fps": 24, "resolution": "4096x2160", "start_date": "2030-01-01", "delivery_date": "2030-12-31"})
    pid = p.json().get("id")
    call(a, "projects_create_duplicate", "POST", "/api/v1/projects/", {"code": "ALPHA", "name": "Alpha 2"})
    call(a, "projects_check_existence", "POST", "/api/v1/projects/check-existence/", {"codes": ["ALPHA", "NOPE"]})
    call(a, "projects_filter_by_code", "GET", "/api/v1/projects/?code=ALPHA")
    call(a, "projects_list", "GET", "/api/v1/projects/")
    call(a, "projects_list_filtered", "GET", "/api/v1/projects/?status=In%20Progress&ordering=-code&search=alp")
    call(a, "projects_detail", "GET", f"/api/v1/projects/{pid}/")
    call(a, "projects_patch", "PATCH", f"/api/v1/projects/{pid}/", {"description": "Renamed in a test", "fps": 25})
    call(a, "projects_patch_bad_fps", "PATCH", f"/api/v1/projects/{pid}/", {"fps": "fast"})
    call(a, "projects_statistics", "GET", f"/api/v1/projects/{pid}/statistics/")
    call(a, "projects_dashboard", "GET", f"/api/v1/projects/{pid}/dashboard/")

    # ------------------------------------------------------------ members
    call(a, "members_get_empty", "GET", f"/api/organizations/projects/{pid}/members/")
    call(a, "members_add", "POST", f"/api/organizations/projects/{pid}/members/", {"user_id": str(artist.id), "role": "Artist"})
    call(a, "members_add_again", "POST", f"/api/organizations/projects/{pid}/members/", {"user_id": str(artist.id), "role": "Artist"})
    call(a, "members_add_by_email", "POST", f"/api/organizations/projects/{pid}/members/", {"email": "outsider@example.test", "role": "Lead"})
    call(a, "members_add_unknown", "POST", f"/api/organizations/projects/{pid}/members/", {"email": "nobody@example.test", "role": "Artist"})
    call(a, "members_get", "GET", f"/api/organizations/projects/{pid}/members/")

    # ------------------------------------------------------------ shows
    call(a, "shows_create_empty", "POST", "/api/v1/shows/", {})
    s = call(a, "shows_create", "POST", "/api/v1/shows/", {"project": pid, "code": "S1", "name": "Season One", "is_primary": True})
    sid = s.json().get("id")
    call(a, "shows_list", "GET", f"/api/v1/shows/?project={pid}")
    call(a, "shows_patch", "PATCH", f"/api/v1/shows/{sid}/", {"description": "First"})
    call(a, "shows_check_existence", "POST", "/api/v1/shows/check-existence/", {"project_id": pid, "codes": ["S1", "S9"]})

    # ------------------------------------------------------------ episodes
    call(a, "episodes_create_empty", "POST", "/api/v1/episodes/", {})
    call(a, "episodes_list_bootstrapped", "GET", f"/api/v1/episodes/?project={pid}")
    e = call(a, "episodes_create", "POST", "/api/v1/episodes/", {"project": pid, "show": sid, "code": "EP101", "name": "Pilot", "episode_number": 1, "season_number": 1})
    e2 = call(a, "episodes_create_second", "POST", "/api/v1/episodes/", {"project": pid, "show": sid, "code": "EP150", "name": "Fifty", "episode_number": 50, "season_number": 1})
    eid = e2.json().get("id")
    call(a, "episodes_list", "GET", f"/api/v1/episodes/?project={pid}")
    call(a, "episodes_patch", "PATCH", f"/api/v1/episodes/{eid}/", {"description": "The first one"})
    call(a, "episodes_check_existence", "POST", "/api/v1/episodes/check-existence/", {"project_id": pid, "codes": ["EP101", "EP102"]})
    call(a, "episodes_bulk_create", "POST", "/api/v1/episodes/bulk-create/", {"project_id": pid, "items": [{"code": "EP102", "data": {"name": "Second", "episode_number": 2, "season_number": 1, "project": pid}}, {"code": "EP101", "data": {"name": "dup", "project": pid}}]})
    call(a, "episodes_archive", "POST", f"/api/v1/episodes/{eid}/archive/", {})
    call(a, "episodes_archived", "GET", f"/api/v1/episodes/archived/?project={pid}")
    call(a, "episodes_restore", "POST", f"/api/v1/episodes/{eid}/restore/", {})

    # ------------------------------------------------------------ sequences
    call(a, "sequences_create_empty", "POST", "/api/v1/sequences/", {})
    q = call(a, "sequences_create", "POST", "/api/v1/sequences/", {"project": pid, "code": "SQ010", "name": "Opening", "episode_id": eid})
    qid = q.json().get("id")
    call(a, "sequences_list", "GET", f"/api/v1/sequences/?project={pid}")
    call(a, "sequences_patch", "PATCH", f"/api/v1/sequences/{qid}/", {"description": "Cold open", "frame_in": 1001, "frame_out": 1100})
    call(a, "sequences_check_existence", "POST", "/api/v1/sequences/check-existence/", {"project_id": pid, "codes": ["SQ010", "SQ020"]})
    call(a, "sequences_bulk_create", "POST", "/api/v1/sequences/bulk-create/", {"project_id": pid, "items": [{"code": "SQ020", "data": {"name": "Chase", "project": pid}}, {"code": "SQ030", "data": {"name": "Finale", "project": pid}}]})
    call(a, "sequences_list_after_bulk", "GET", f"/api/v1/sequences/?project={pid}&ordering=code")
    ids = [r["id"] for r in a.get(f"/api/v1/sequences/?project={pid}").json().get("results", [])]
    call(a, "sequences_bulk_update", "POST", "/api/v1/sequences/bulk-update/", {"items": [{"id": i, "data": {"description": "bulk"}} for i in ids[:2]]})
    call(a, "sequences_bulk_archive", "POST", "/api/v1/sequences/bulk-archive/", {"ids": ids[:2]})
    call(a, "sequences_archived", "GET", f"/api/v1/sequences/archived/?project={pid}")
    call(a, "sequences_bulk_restore", "POST", "/api/v1/sequences/bulk-restore/", {"ids": ids[:2]})

    # ------------------------------------------------------------ editorial
    call(a, "tracks_create_empty", "POST", "/api/v1/editorial/tracks/", {})
    t = call(a, "tracks_create", "POST", "/api/v1/editorial/tracks/", {"project": pid, "name": "V1", "track_type": "Video", "track_number": 1})
    call(a, "tracks_list", "GET", f"/api/v1/editorial/tracks/?project_id={pid}")
    call(a, "tracks_patch", "PATCH", f"/api/v1/editorial/tracks/{t.json().get('id')}/", {"name": "V1 (main)"})

    # ------------------------------------------------------------ project-scoped reads
    for view in ("summary", "activity", "notes", "pipeline", "resources", "files", "schedule", "editorial", "sequences", "dashboard"):
        call(a, f"scoped_{view}", "GET", f"/api/organizations/projects/{pid}/{view}/")
    call(a, "scoped_notes_post", "POST", f"/api/organizations/projects/{pid}/notes/", {"subject": "Hello", "content": "First note"})
    call(a, "scoped_notes_after", "GET", f"/api/organizations/projects/{pid}/notes/")

    # ------------------------------------------------------------ archive / restore the project
    call(a, "shows_archive", "POST", f"/api/v1/shows/{sid}/archive/", {})
    call(a, "projects_archive", "POST", f"/api/v1/projects/{pid}/archive/", {})
    call(a, "projects_destroy", "DELETE", f"/api/v1/projects/{pid}/")
    call(a, "projects_archived_list", "GET", "/api/v1/projects/archived/")
    call(a, "projects_detail_archived", "GET", f"/api/v1/projects/{pid}/")
    call(a, "projects_restore", "POST", f"/api/v1/projects/{pid}/restore/", {})
    call(a, "projects_list_after_restore", "GET", "/api/v1/projects/")

    # ------------------------------------------------------------ non-privileged callers
    m, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase5!9")  # a member
    o, _ = sign_in_plain("outsider@example.test", "Outsider-Pass-Phase5!9")  # added by email as Lead too
    call(m, "member_projects_list", "GET", "/api/v1/projects/")
    call(m, "member_project_detail", "GET", f"/api/v1/projects/{pid}/")
    call(m, "member_project_patch", "PATCH", f"/api/v1/projects/{pid}/", {"description": "nope"})
    call(m, "member_project_create", "POST", "/api/v1/projects/", {"code": "BETA", "name": "Beta"})
    call(m, "member_scoped_summary", "GET", f"/api/organizations/projects/{pid}/summary/")
    call(m, "member_sequence_create", "POST", "/api/v1/sequences/", {"project": pid, "code": "SQ099", "name": "x"})
    call(m, "member_members_add", "POST", f"/api/organizations/projects/{pid}/members/", {"email": "outsider@example.test"})
    stranger = U.create_user(email="stranger@example.test", password="Stranger-Pass-Phase5!9")
    stranger.is_active = True
    stranger.save()
    sg, _ = sign_in_plain("stranger@example.test", "Stranger-Pass-Phase5!9")
    call(sg, "stranger_projects_list", "GET", "/api/v1/projects/")
    call(sg, "stranger_project_detail", "GET", f"/api/v1/projects/{pid}/")
    call(sg, "stranger_scoped_summary", "GET", f"/api/organizations/projects/{pid}/summary/")

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_structure_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
    del o


