"""
Phase 6 sample capture: shots, assets, tasks, timelogs, task templates (docs/sync).

Real JWT flow for four users (an MFA superuser, a lead-artist, two artists); every call is recorded
whatever its status, so failures (the interesting part of a contract) are data, not errors. Pytest
test database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_production_work.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_capture_identity_admin import FLOW, call, redact, sign_in_plain, sign_in_with_mfa  # noqa: E402

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])


def _user(U, email, password, role_code=None):
    from apps.identity.models import Role, UserRole

    user = U.create_user(email=email, password=password)
    user.is_active = True
    user.save()
    if role_code:
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
    return user


@pytest.mark.django_db
def test_capture_production_work(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.tests.mfa_helpers import enable_mfa

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase6!9")
    enable_mfa(admin)
    lead = _user(U, "lead@example.test", "Lead-Pass-Phase6!9", "lead-artist")
    artist = _user(U, "artist@example.test", "Artist-Pass-Phase6!9", "artist")
    artist2 = _user(U, "artist2@example.test", "Artist2-Pass-Phase6!9", "artist")
    _user(U, "stranger@example.test", "Stranger-Pass-Phase6!9", "artist")

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase6!9", admin)

    # ------------------------------------------------------------ setup: project, staff, sequence
    p = call(a, "setup_project", "POST", "/api/v1/projects/", {"code": "WORK", "name": "Work", "workflow_type": "standard", "type": "Feature Film"})
    pid = p.json()["id"]
    for who, role in ((lead, "Lead"), (artist, "Artist"), (artist2, "Artist")):
        call(a, f"setup_member_{who.email.split('@')[0]}", "POST", f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": role})
    q = call(a, "setup_sequence", "POST", "/api/v1/sequences/", {"project": pid, "code": "SQ010", "name": "Opening"})
    qid = q.json()["id"]
    q2id = call(a, "setup_sequence_two", "POST", "/api/v1/sequences/", {"project": pid, "code": "SQ020", "name": "Chase"}).json()["id"]
    call(a, "catalog_task_types", "GET", "/api/v1/platform/master-data/task-types")
    call(a, "catalog_asset_types", "GET", "/api/v1/platform/master-data/asset-types")
    call(a, "catalog_shot_types", "GET", "/api/v1/platform/master-data/shot-types")

    def probe(prefix, base, params, client=None):
        client = client or a
        call(client, f"{prefix}_baseline", "GET", base)
        for name, value in params:
            call(client, f"{prefix}_by_{name}_{re.sub('[^A-Za-z0-9]+', '', str(value))[:10]}", "GET", f"{base}{'&' if '?' in base else '?'}{name}={value}")

    probe_tasks = probe

    # ------------------------------------------------------------ shots
    call(a, "shots_create_empty", "POST", "/api/v1/shots/", {})
    s = call(a, "shots_create", "POST", "/api/v1/shots/", {"project": pid, "sequence_id": qid, "code": "SH0010", "name": "Hero walk", "frame_in": 1001, "frame_out": 1096, "handle_frames": 8})
    sid = s.json().get("id")
    call(a, "shots_create_duplicate", "POST", "/api/v1/shots/", {"project": pid, "sequence_id": qid, "code": "sh0010", "name": "dup"})
    call(a, "shots_create_bad_range", "POST", "/api/v1/shots/", {"project": pid, "code": "SH0020", "frame_in": 200, "frame_out": 100})
    call(a, "shots_create_second", "POST", "/api/v1/shots/", {"project": pid, "code": "SH0020", "name": "Hero turn", "sequence_id": q2id})
    call(a, "shots_list", "GET", f"/api/v1/shots/?project={pid}")
    call(a, "shots_list_filtered", "GET", f"/api/v1/shots/?project_id={pid}&ordering=-code&search=hero")
    call(a, "shots_detail", "GET", f"/api/v1/shots/{sid}/")
    call(a, "shots_patch", "PATCH", f"/api/v1/shots/{sid}/", {"description": "Walks to camera", "assigned_artist": str(artist.id)})
    call(a, "shots_patch_status_in_progress", "PATCH", f"/api/v1/shots/{sid}/", {"status": "In Progress"})
    call(a, "shots_approve_from_in_progress", "POST", f"/api/v1/shots/{sid}/approve/", {})
    call(a, "shots_patch_status_review", "PATCH", f"/api/v1/shots/{sid}/", {"status": "Pending Review"})
    call(a, "shots_patch_status_invalid", "PATCH", f"/api/v1/shots/{sid}/", {"status": "Bogus"})
    call(a, "shots_status_history", "GET", f"/api/v1/shots/{sid}/status-history/")
    call(a, "shots_check_existence", "POST", "/api/v1/shots/check-existence/", {"project_id": pid, "codes": ["SH0010", "SH0099"]})
    call(a, "shots_rename_code_empty", "POST", f"/api/v1/shots/{sid}/rename-code/", {})
    call(a, "shots_rename_code", "POST", f"/api/v1/shots/{sid}/rename-code/", {"code": "SH0015"})
    call(a, "shots_bulk_create", "POST", "/api/v1/shots/bulk-create/", {"project_id": pid, "items": [{"code": "SH0030", "data": {"name": "Bulk A", "project": pid, "sequence_id": qid}}, {"code": "SH0015", "data": {"name": "dup", "project": pid}}]})
    ids = [r["id"] for r in a.get(f"/api/v1/shots/?project={pid}&ordering=code").json().get("results", [])]
    call(a, "shots_bulk_update", "POST", "/api/v1/shots/bulk-update/", {"items": [{"id": i, "data": {"description": "bulk"}} for i in ids[:2]]})
    call(a, "shots_bulk_archive", "POST", "/api/v1/shots/bulk-archive/", {"ids": ids[-1:]})
    call(a, "shots_archived", "GET", f"/api/v1/shots/archived/?project={pid}")
    call(a, "shots_bulk_restore", "POST", "/api/v1/shots/bulk-restore/", {"ids": ids[-1:]})

    # ------------------------------------------------------------ assets
    call(a, "assets_create_empty", "POST", "/api/v1/assets/", {})
    ast = call(a, "assets_create", "POST", "/api/v1/assets/", {"project": pid, "code": "CHR_HERO", "name": "Hero", "category": "Character", "description": "Main character"})
    aid = ast.json().get("id")
    call(a, "assets_create_duplicate", "POST", "/api/v1/assets/", {"project": pid, "code": "chr_hero", "name": "dup", "category": "Character"})
    call(a, "assets_create_bad_category", "POST", "/api/v1/assets/", {"project": pid, "code": "X1", "name": "x", "category": "Nonsense"})
    child = call(a, "assets_create_child", "POST", "/api/v1/assets/", {"project": pid, "code": "CHR_HERO_HAT", "name": "Hat", "category": "Prop", "parent_asset": aid})
    call(a, "assets_list", "GET", f"/api/v1/assets/?project={pid}")
    call(a, "assets_list_filtered", "GET", f"/api/v1/assets/?project_id={pid}&category=Character&search=hero&ordering=-code")
    call(a, "assets_detail", "GET", f"/api/v1/assets/{aid}/")
    call(a, "assets_patch", "PATCH", f"/api/v1/assets/{aid}/", {"description": "Updated", "status": "In Progress"})
    call(a, "assets_check_existence", "POST", "/api/v1/assets/check-existence/", {"project_id": pid, "codes": ["CHR_HERO", "NOPE"]})
    call(a, "assets_rename_code", "POST", f"/api/v1/assets/{aid}/rename-code/", {"code": "CHR_HERO_V2"})
    call(a, "assets_link_empty", "POST", f"/api/v1/shots/{sid}/assets/", {})
    call(a, "assets_link", "POST", f"/api/v1/shots/{sid}/assets/", {"asset_id": aid, "quantity": 2, "notes": "wears the hat"})
    call(a, "assets_link_again", "POST", f"/api/v1/shots/{sid}/assets/", {"asset_id": aid})
    call(a, "shots_assets", "GET", f"/api/v1/shots/{sid}/assets/")
    call(a, "assets_shots", "GET", f"/api/v1/assets/{aid}/shots/")
    call(a, "assets_link_patch", "PATCH", f"/api/v1/shots/{sid}/assets/{aid}/", {"quantity": 3})
    call(a, "assets_bulk_create", "POST", "/api/v1/assets/bulk-create/", {"project_id": pid, "items": [{"code": "ENV_STREET", "data": {"name": "Street", "category": "Environment", "project": pid}}]})
    call(a, "assets_archive", "POST", f"/api/v1/assets/{child.json().get('id')}/archive/", {})
    call(a, "assets_archived", "GET", f"/api/v1/assets/archived/?project={pid}")
    call(a, "assets_restore", "POST", f"/api/v1/assets/{child.json().get('id')}/restore/", {})

    # ------------------------------------------------------------ tasks
    call(a, "tasks_create_empty", "POST", "/api/v1/tasks/", {})
    call(a, "catalog_task_type_create", "POST", "/api/v1/platform/master-data/task-types", {"name": "Compositing", "code": "comp"})
    call(a, "catalog_task_type_create_two", "POST", "/api/v1/platform/master-data/task-types", {"name": "Roto", "code": "roto"})
    tt = a.get("/api/v1/platform/master-data/task-types").json()
    tt_rows = tt if isinstance(tt, list) else tt.get("results", [])
    tt_id = tt_rows[0]["id"] if tt_rows else None
    t = call(a, "tasks_create", "POST", "/api/v1/tasks/", {"project": pid, "title": "Comp hero walk", "code": "T001", "entity_type": "Shot", "entity_id": sid, "assignee": str(artist.id), "reviewer": str(lead.id), "priority": "High", "due_date": "2030-02-01", "estimated_hours": "12.50", **({"task_type_id": tt_id} if tt_id else {})})
    tid = t.json().get("id")
    call(a, "tasks_create_entity_forms", "POST", "/api/v1/tasks/", {"project": pid, "title": "Entity form", "code": "T002", "entity_type": "Shot", "entity_id": sid})
    call(a, "tasks_create_shot_id_ignored", "POST", "/api/v1/tasks/", {"project": pid, "title": "shot_id key", "code": "T003", "shot_id": sid})
    call(a, "tasks_create_asset_link", "POST", "/api/v1/tasks/", {"project": pid, "title": "Asset task", "code": "T006", "entity_type": "Asset", "entity_id": aid})
    call(a, "tasks_create_mismatched_link", "POST", "/api/v1/tasks/", {"project": pid, "title": "Mismatch", "code": "T007", "entity_type": "Asset", "entity_id": sid})
    call(a, "tasks_create_sequence_link", "POST", "/api/v1/tasks/", {"project": pid, "title": "Seq task", "code": "T008", "entity_type": "Sequence", "entity_id": qid})
    call(a, "tasks_create_outsider_assignee", "POST", "/api/v1/tasks/", {"project": pid, "title": "Outsider", "code": "T004", "assignee": str(U.get(email="stranger@example.test").id)})
    call(a, "tasks_create_duplicate", "POST", "/api/v1/tasks/", {"project": pid, "title": "dup", "code": "t001"})
    call(a, "tasks_create_general", "POST", "/api/v1/tasks/", {"project": pid, "title": "General work", "code": "T005", "entity_type": "General"})
    call(a, "tasks_list", "GET", f"/api/v1/tasks/?project={pid}")
    call(a, "tasks_list_filtered", "GET", f"/api/v1/tasks/?project_id={pid}&ordering=-due_date&search=comp")
    call(a, "tasks_detail", "GET", f"/api/v1/tasks/{tid}/")
    call(a, "tasks_patch", "PATCH", f"/api/v1/tasks/{tid}/", {"description": "Needs roto", "tags": ["roto"]})
    call(a, "tasks_status_in_progress", "PATCH", f"/api/v1/tasks/{tid}/", {"status": "In Progress"})
    call(a, "tasks_status_approved_direct", "PATCH", f"/api/v1/tasks/{tid}/", {"status": "Approved"})
    call(a, "tasks_status_review", "PATCH", f"/api/v1/tasks/{tid}/", {"status": "Pending Review"})
    call(a, "tasks_status_history", "GET", f"/api/v1/tasks/{tid}/status-history/")
    probe_tasks("fp_tasks", f"/api/v1/tasks/?project_id={pid}", [("status", "Pending%20Review"), ("priority", "High"), ("entity_type", "Shot"), ("entity_id", sid), ("shot_id", sid), ("asset_id", aid), ("sequence_id", qid), ("assignee", artist.id), ("assignee_id", artist.id), ("reviewer", lead.id), ("is_archived", "false"), ("is_archived", "true"), ("show_id", "00000000-0000-0000-0000-000000000000"), ("status", "ALL"), ("search", "comp"), ("code", "T001"), ("department", "Compositing"), ("team", "00000000-0000-0000-0000-000000000000"), ("nonsense", "1")])
    call(a, "tasks_check_existence", "POST", "/api/v1/tasks/check-existence/", {"project_id": pid, "codes": ["T001", "T099"]})
    call(a, "tasks_bulk_create", "POST", "/api/v1/tasks/bulk-create/", {"project_id": pid, "items": [{"code": "T010", "data": {"title": "Bulk 1", "project": pid, "entity_type": "General"}}, {"code": "T001", "data": {"title": "dup", "project": pid}}]})
    tids = [r["id"] for r in a.get(f"/api/v1/tasks/?project={pid}&ordering=code").json().get("results", [])]
    call(a, "tasks_bulk_assign", "POST", "/api/v1/tasks/bulk-assign/", {"task_ids": tids[:2], "assignee_id": str(artist2.id)})
    call(a, "tasks_bulk_assign_outsider", "POST", "/api/v1/tasks/bulk-assign/", {"task_ids": tids[:1], "assignee_id": str(U.get(email="stranger@example.test").id)})
    call(a, "tasks_bulk_status", "POST", "/api/v1/tasks/bulk-status/", {"task_ids": tids[:3], "status": "In Progress"})
    call(a, "tasks_bulk_status_invalid", "POST", "/api/v1/tasks/bulk-status/", {"task_ids": tids[:1], "status": "Bogus"})
    call(a, "tasks_bulk_status_forbidden_move", "POST", "/api/v1/tasks/bulk-status/", {"task_ids": tids[:1], "status": "Approved"})
    call(a, "tasks_bulk_update", "POST", "/api/v1/tasks/bulk-update/", {"items": [{"id": i, "data": {"priority": "Low"}} for i in tids[:2]]})
    call(a, "tasks_bulk_archive", "POST", "/api/v1/tasks/bulk-archive/", {"ids": tids[-1:]})
    call(a, "tasks_archived", "GET", f"/api/v1/tasks/archived/?project={pid}")
    call(a, "tasks_bulk_restore", "POST", "/api/v1/tasks/bulk-restore/", {"ids": tids[-1:]})
    call(a, "tasks_archive_one", "POST", f"/api/v1/tasks/{tids[-1]}/archive/", {})
    call(a, "tasks_restore_one", "POST", f"/api/v1/tasks/{tids[-1]}/restore/", {})


    # ------------------------------------------------------------ filter probes: one param each (unknown params are silently ignored)
    probe("fp_shots", f"/api/v1/shots/?project_id={pid}", [("status", "Pending%20Review"), ("code", "SH0020"), ("sequence", "SQ010"), ("sequence_code", "SQ010"), ("sequence_id", qid), ("search", "turn"), ("assigned_artist", artist.id), ("episode_id", "00000000-0000-0000-0000-000000000000"), ("nonsense", "1")])
    probe("fp_assets", f"/api/v1/assets/?project_id={pid}", [("status", "In%20Progress"), ("category", "Character"), ("search", "hero"), ("code", "ENV_STREET"), ("nonsense", "1")])

    # ------------------------------------------------------------ timelogs (artist logs, lead approves)
    ar, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase6!9")
    ld, _ = sign_in_plain("lead@example.test", "Lead-Pass-Phase6!9")
    ar2, _ = sign_in_plain("artist2@example.test", "Artist2-Pass-Phase6!9")
    call(ar, "timelogs_create_empty", "POST", "/api/v1/timelogs/", {})
    tl = call(ar, "timelogs_create", "POST", "/api/v1/timelogs/", {"task_id": tid, "duration_hours": "3.50", "date": "2030-01-15", "notes": "Roto pass", "billable": True})
    tlid = tl.json().get("id")
    call(ar, "timelogs_create_future_or_bad", "POST", "/api/v1/timelogs/", {"task_id": tid, "duration_hours": "-1", "date": "2030-01-15"})
    call(ar, "timelogs_create_for_other_denied", "POST", "/api/v1/timelogs/", {"task_id": tid, "duration_hours": "1", "date": "2030-01-16", "person_id": str(lead.id)})
    call(ar, "timelogs_list_own", "GET", f"/api/v1/timelogs/?project_id={pid}")
    call(ar, "timelogs_detail", "GET", f"/api/v1/timelogs/{tlid}/")
    call(ar, "timelogs_patch", "PATCH", f"/api/v1/timelogs/{tlid}/", {"duration_hours": "4.00"})
    call(ar2, "timelogs_other_artist_list", "GET", f"/api/v1/timelogs/?project_id={pid}")
    call(ar2, "timelogs_other_artist_detail", "GET", f"/api/v1/timelogs/{tlid}/")
    call(ld, "timelogs_lead_list_all", "GET", f"/api/v1/timelogs/?project_id={pid}&status=Submitted&person={artist.id}&date=2030-01-15")
    call(ar, "timelogs_artist_self_approve", "POST", f"/api/v1/timelogs/{tlid}/approve/", {})
    call(ld, "timelogs_reject_empty", "POST", f"/api/v1/timelogs/{tlid}/reject/", {})
    call(ld, "timelogs_reject", "POST", f"/api/v1/timelogs/{tlid}/reject/", {"rejection_reason": "Wrong task"})
    call(ar, "timelogs_after_reject", "GET", f"/api/v1/timelogs/{tlid}/")
    call(ar, "timelogs_patch_rejected", "PATCH", f"/api/v1/timelogs/{tlid}/", {"status": "Submitted", "notes": "Fixed"})
    call(ld, "timelogs_approve", "POST", f"/api/v1/timelogs/{tlid}/approve/", {})
    call(ld, "timelogs_status_history", "GET", f"/api/v1/timelogs/{tlid}/status-history/")
    call(ar, "timelogs_patch_approved", "PATCH", f"/api/v1/timelogs/{tlid}/", {"notes": "late edit"})
    call(ar, "timelogs_adjustment", "POST", "/api/v1/timelogs/", {"task_id": tid, "duration_hours": "-0.50", "date": "2030-01-16", "adjustment_of": tlid})
    call(ld, "timelogs_lead_self_log_and_approve", "POST", "/api/v1/timelogs/", {"task_id": tid, "duration_hours": "1", "date": "2030-01-17"})
    call(ar, "task_after_time", "GET", f"/api/v1/tasks/{tid}/")
    call(ar, "timelogs_archived", "GET", f"/api/v1/timelogs/archived/?project_id={pid}")
    call(a, "timelogs_admin_list", "GET", f"/api/v1/timelogs/?project_id={pid}&ordering=-date")

    probe("fp_timelogs", f"/api/v1/timelogs/?project_id={pid}", [("status", "Approved"), ("status", "Rejected"), ("task", tid), ("person", artist.id), ("billable", "true"), ("billable", "false"), ("date", "2030-01-15"), ("start_date", "2030-01-16"), ("end_date", "2030-01-15"), ("search", "Roto"), ("nonsense", "1")], client=ld)
    # ------------------------------------------------------------ the artist/lead wall on shots, assets, tasks
    call(ar, "artist_shot_create", "POST", "/api/v1/shots/", {"project": pid, "code": "SH0777", "name": "x"})
    call(ar, "artist_shot_patch", "PATCH", f"/api/v1/shots/{sid}/", {"description": "nope"})
    call(ar, "artist_shot_approve", "POST", f"/api/v1/shots/{sid}/approve/", {})
    call(ld, "lead_shot_approve", "POST", f"/api/v1/shots/{sid}/approve/", {})
    call(ld, "lead_shot_status_history", "GET", f"/api/v1/shots/{sid}/status-history/")
    call(ld, "lead_shot_leave_approved", "PATCH", f"/api/v1/shots/{sid}/", {"status": "In Progress"})
    call(ld, "lead_shot_create", "POST", "/api/v1/shots/", {"project": pid, "code": "SH0778", "name": "x"})
    call(ar, "artist_asset_create", "POST", "/api/v1/assets/", {"project": pid, "code": "PRP_X", "name": "x", "category": "Prop"})
    call(ar, "artist_task_create", "POST", "/api/v1/tasks/", {"project": pid, "title": "mine", "code": "T777"})
    call(ar, "artist_task_update", "PATCH", f"/api/v1/tasks/{tid}/", {"status": "In Progress"})
    call(ar, "artist_task_delete", "DELETE", f"/api/v1/tasks/{tid}/")
    call(ar, "artist_task_list", "GET", f"/api/v1/tasks/?project_id={pid}")
    call(ld, "lead_task_create", "POST", "/api/v1/tasks/", {"project": pid, "title": "lead's", "code": "T778", "entity_type": "General"})
    call(ar, "artist_rename_code", "POST", f"/api/v1/shots/{sid}/rename-code/", {"code": "SHX"})
    call(ar, "scoped_shots", "GET", f"/api/organizations/projects/{pid}/shots/")
    call(ar, "scoped_tasks", "GET", f"/api/organizations/projects/{pid}/tasks/")
    call(ar, "scoped_assets", "GET", f"/api/organizations/projects/{pid}/assets/")
    sg, _ = sign_in_plain("stranger@example.test", "Stranger-Pass-Phase6!9")
    call(sg, "stranger_shots", "GET", f"/api/v1/shots/?project={pid}")
    call(sg, "stranger_shot_detail", "GET", f"/api/v1/shots/{sid}/")
    call(sg, "stranger_task_detail", "GET", f"/api/v1/tasks/{tid}/")

    # ------------------------------------------------------------ task templates
    call(a, "templates_create_empty", "POST", "/api/v1/task-templates/", {})
    tt2 = tt_rows[1]["id"] if len(tt_rows) > 1 else tt_id
    items = [{"task_type_id": str(tt_id), "name": "Comp", "order": 1, "default_bid_hours": "8"}, {"task_type_id": str(tt2), "name": "Roto", "order": 2, "default_bid_hours": "4"}] if tt_id else []
    tp = call(a, "templates_create", "POST", "/api/v1/task-templates/", {"name": "Shot starter", "description": "Default shot tasks", "entity_type": "Shot", "items": items})
    tpid = tp.json().get("id")
    call(a, "templates_create_project_scoped", "POST", "/api/v1/task-templates/", {"name": "Project only", "entity_type": "Asset", "project_id": pid, "items": items})
    probe("fp_templates", "/api/v1/task-templates/", [("entity_type", "Shot"), ("entity_type", "Asset"), ("is_active", "false"), ("studio", "true"), ("studio", "false"), ("project_id", pid), ("nonsense", "1")])
    call(a, "templates_list", "GET", "/api/v1/task-templates/")
    call(a, "templates_list_filtered", "GET", f"/api/v1/task-templates/?entity_type=Shot&is_active=true&project_id={pid}")
    call(a, "templates_detail", "GET", f"/api/v1/task-templates/{tpid}/")
    call(a, "templates_patch", "PATCH", f"/api/v1/task-templates/{tpid}/", {"description": "Edited"})
    call(a, "templates_apply_empty", "POST", f"/api/v1/task-templates/{tpid}/apply/", {})
    call(a, "templates_apply", "POST", f"/api/v1/task-templates/{tpid}/apply/", {"project_id": pid, "entity_id": ids[1]})
    call(a, "templates_apply_again", "POST", f"/api/v1/task-templates/{tpid}/apply/", {"project_id": pid, "entity_id": ids[1]})
    call(a, "templates_copy_to_project", "POST", f"/api/v1/task-templates/{tpid}/copy-to-project/", {"project_id": pid, "name": "Copied"})
    call(ar, "templates_artist_list", "GET", "/api/v1/task-templates/")
    call(ld, "templates_lead_create", "POST", "/api/v1/task-templates/", {"name": "Lead tpl", "entity_type": "Shot", "items": items})
    call(a, "templates_delete", "DELETE", f"/api/v1/task-templates/{tpid}/")

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_work_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
