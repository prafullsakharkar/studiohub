"""
Phase 7 sample capture: versions, reviews, playlists, media, workflows, automations (docs/sync).

Real JWT flow for an MFA superuser, a lead-artist, two artists and a vfx-supervisor (the seeded role that
holds `review.approve`); every call is recorded whatever its status, so failures are data. Pytest test
database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_production_review.py
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
def test_capture_production_review(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.tests.mfa_helpers import enable_mfa

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase7!9")
    enable_mfa(admin)
    lead = _user(U, "lead@example.test", "Lead-Pass-Phase7!9", "lead-artist")
    artist = _user(U, "artist@example.test", "Artist-Pass-Phase7!9", "artist")
    artist2 = _user(U, "artist2@example.test", "Artist2-Pass-Phase7!9", "artist")
    sup = _user(U, "sup@example.test", "Sup-Pass-Phase7!9", "vfx-supervisor")
    _user(U, "stranger@example.test", "Stranger-Pass-Phase7!9", "artist")

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase7!9", admin)
    ar, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase7!9")
    ar2, _ = sign_in_plain("artist2@example.test", "Artist2-Pass-Phase7!9")
    ld, _ = sign_in_plain("lead@example.test", "Lead-Pass-Phase7!9")
    sv, _ = sign_in_plain("sup@example.test", "Sup-Pass-Phase7!9")
    sg, _ = sign_in_plain("stranger@example.test", "Stranger-Pass-Phase7!9")

    # ------------------------------------------------------------ setup
    pid = call(a, "setup_project", "POST", "/api/v1/projects/", {"code": "REV", "name": "Review", "workflow_type": "standard"}).json()["id"]
    for who, role in ((lead, "Lead"), (artist, "Artist"), (artist2, "Artist"), (sup, "Supervisor")):
        call(a, f"setup_member_{who.email.split('@')[0]}", "POST", f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": role})
    qid = call(a, "setup_sequence", "POST", "/api/v1/sequences/", {"project": pid, "code": "SQ010", "name": "Opening"}).json()["id"]
    sid = call(a, "setup_shot", "POST", "/api/v1/shots/", {"project": pid, "sequence_id": qid, "code": "SH0010", "name": "Walk"}).json()["id"]
    sid2 = call(a, "setup_shot_two", "POST", "/api/v1/shots/", {"project": pid, "sequence_id": qid, "code": "SH0020", "name": "Turn"}).json()["id"]
    aid = call(a, "setup_asset", "POST", "/api/v1/assets/", {"project": pid, "code": "CHR_HERO", "name": "Hero", "category": "Character"}).json()["id"]
    tid = call(a, "setup_task", "POST", "/api/v1/tasks/", {"project": pid, "title": "Comp", "code": "T001", "entity_type": "Shot", "entity_id": sid, "assignee": str(artist.id)}).json()["id"]

    # ------------------------------------------------------------ versions
    call(ar, "versions_create_empty", "POST", "/api/v1/versions/", {})
    v = call(ar, "versions_create", "POST", "/api/v1/versions/", {"project": pid, "shot": sid, "task": tid, "department": "Compositing", "notes": "first pass", "tags": ["wip"], "resolution": "4096x2160", "fps": 24, "start_frame": 1001, "end_frame": 1096})
    vid = v.json().get("id")
    vid2 = call(ar, "versions_create_second", "POST", "/api/v1/versions/", {"project": pid, "shot": sid, "task": tid, "notes": "second pass"}).json()["id"]
    call(ar, "versions_create_for_asset", "POST", "/api/v1/versions/", {"project": pid, "asset": aid, "notes": "asset v1"})
    call(ar, "versions_create_both", "POST", "/api/v1/versions/", {"project": pid, "shot": sid, "asset": aid})
    call(ar, "versions_create_number_ignored", "POST", "/api/v1/versions/", {"project": pid, "shot": sid2, "version_number": "v099"})
    call(ar, "versions_list", "GET", f"/api/v1/versions/?project={pid}")
    call(ar, "versions_detail", "GET", f"/api/v1/versions/{vid}/")
    call(ar, "versions_artist_patch", "PATCH", f"/api/v1/versions/{vid}/", {"notes": "edited"})
    call(ld, "versions_lead_patch", "PATCH", f"/api/v1/versions/{vid}/", {"notes": "edited by lead"})
    call(ld, "versions_status_in_progress", "PATCH", f"/api/v1/versions/{vid}/", {"status": "In Progress"})
    call(ld, "versions_status_review", "PATCH", f"/api/v1/versions/{vid}/", {"status": "Pending Review"})
    call(ld, "versions_publish_unapproved", "POST", f"/api/v1/versions/{vid}/publish/", {})
    call(ar, "versions_artist_approve_own", "POST", f"/api/v1/versions/{vid}/promote/", {})
    own_id = call(a, "versions_admin_creates_own", "POST", "/api/v1/versions/", {"project": pid, "shot": sid2, "notes": "admin made"}).json()["id"]
    call(a, "versions_admin_own_to_review", "PATCH", f"/api/v1/versions/{own_id}/", {"status": "Pending Review"})
    call(a, "versions_admin_approves_own", "PATCH", f"/api/v1/versions/{own_id}/", {"status": "Approved"})
    call(a, "versions_admin_promotes_own", "POST", f"/api/v1/versions/{own_id}/promote/", {})
    call(ld, "versions_lead_approves", "PATCH", f"/api/v1/versions/{vid}/", {"status": "Approved"})
    call(ld, "versions_status_history", "GET", f"/api/v1/versions/{vid}/status-history/")
    call(ld, "versions_publish", "POST", f"/api/v1/versions/{vid}/publish/", {"dcc_software": "Nuke", "dcc_version": "15.0"})
    call(ld, "versions_publish_twice", "POST", f"/api/v1/versions/{vid}/publish/", {})
    call(ld, "versions_published_edit", "PATCH", f"/api/v1/versions/{vid}/", {"department": "FX"})
    call(ld, "versions_published_notes_edit", "PATCH", f"/api/v1/versions/{vid}/", {"notes": "notes still editable"})
    call(ld, "versions_published_archive", "POST", f"/api/v1/versions/{vid}/archive/", {})
    call(ld, "versions_promote", "POST", f"/api/v1/versions/{vid}/promote/", {})
    call(ld, "versions_detail_after_promote", "GET", f"/api/v1/versions/{vid}/")
    call(ld, "versions_unpublish", "POST", f"/api/v1/versions/{vid}/unpublish/", {})
    call(ld, "versions_unpublish_twice", "POST", f"/api/v1/versions/{vid}/unpublish/", {})
    call(ld, "versions_publish_again", "POST", f"/api/v1/versions/{vid}/publish/", {})
    call(ar, "versions_artist_publish", "POST", f"/api/v1/versions/{vid}/publish/", {})
    call(ar, "shots_detail_current_version", "GET", f"/api/v1/shots/{sid}/")

    # ------------------------------------------------------------ playlists
    call(ld, "playlists_create_empty", "POST", "/api/v1/playlists/", {})
    pl = call(ld, "playlists_create", "POST", "/api/v1/playlists/", {"project": pid, "name": "Dailies", "code": "DAILY1", "description": "Monday dailies"})
    plid = pl.json().get("id")
    call(ld, "playlists_create_with_entries", "POST", "/api/v1/playlists/", {"project": pid, "name": "Seeded", "code": "SEED1", "entries": [{"version_id": vid}]})
    call(ld, "playlists_create_foreign_version", "POST", "/api/v1/playlists/", {"project": pid, "name": "Bad", "code": "BAD1", "entries": [{"version_id": "00000000-0000-0000-0000-000000000000"}]})
    call(ld, "playlists_add_entry_empty", "POST", f"/api/v1/playlists/{plid}/add-entry/", {})
    call(ld, "playlists_add_entry", "POST", f"/api/v1/playlists/{plid}/add-entry/", {"version_id": vid})
    call(ld, "playlists_add_entry_two", "POST", f"/api/v1/playlists/{plid}/add-entry/", {"version_id": vid2})
    call(ld, "playlists_detail", "GET", f"/api/v1/playlists/{plid}/")
    entries = ld.get(f"/api/v1/playlists/{plid}/").json().get("entries", [])
    eids = [e["id"] for e in entries]
    call(ld, "playlists_reorder", "POST", f"/api/v1/playlists/{plid}/reorder/", {"entries": [{"id": eids[-1]}, {"id": eids[0]}]} if len(eids) > 1 else {"entries": []})
    call(ld, "playlists_reorder_unknown", "POST", f"/api/v1/playlists/{plid}/reorder/", {"entries": [{"id": "nope"}]})
    call(ld, "playlists_patch_entries_locked", "PATCH", f"/api/v1/playlists/{plid}/", {"entries": []})
    call(ld, "playlists_remove_entry", "POST", f"/api/v1/playlists/{plid}/remove-entry/", {"entry_id": eids[0]} if eids else {})
    call(ld, "playlists_remove_entry_unknown", "POST", f"/api/v1/playlists/{plid}/remove-entry/", {"entry_id": "nope"})
    call(ld, "versions_add_to_playlist", "POST", f"/api/v1/versions/{vid}/add-to-playlist/", {"playlist_id": plid})
    call(ld, "versions_add_to_new_playlist", "POST", f"/api/v1/versions/{vid2}/add-to-playlist/", {"playlist_name": "Fresh from version"})
    call(ld, "playlists_share", "POST", f"/api/v1/playlists/{plid}/share/", {"is_public": True, "require_passcode": True, "allow_client_approval": False})
    call(ld, "playlists_share_empty", "POST", f"/api/v1/playlists/{plid}/share/", {})
    call(ld, "playlists_share_bad_key", "POST", f"/api/v1/playlists/{plid}/share/", {"is_public": "maybe"})
    call(ld, "playlists_patch_name", "PATCH", f"/api/v1/playlists/{plid}/", {"name": "Dailies (renamed)", "client_only": True})
    call(ld, "playlists_list", "GET", f"/api/v1/playlists/?project={pid}")
    call(ar, "playlists_artist_create", "POST", "/api/v1/playlists/", {"project": pid, "name": "x", "code": "X1"})
    call(ar, "playlists_artist_list", "GET", f"/api/v1/playlists/?project={pid}")
    call(ld, "playlists_archive", "POST", f"/api/v1/playlists/{plid}/archive/", {})
    call(ld, "playlists_archived", "GET", f"/api/v1/playlists/archived/?project={pid}")
    call(ld, "playlists_restore", "POST", f"/api/v1/playlists/{plid}/restore/", {})

    # ------------------------------------------------------------ reviews
    call(sv, "reviews_create_empty", "POST", "/api/v1/reviews/", {})
    rv = call(sv, "reviews_create", "POST", "/api/v1/reviews/", {"project": pid, "title": "Walk review", "code": "RV001", "entity_type": "Shot", "entity_id": sid, "description": "Dailies review"})
    rid = rv.json().get("id")
    call(sv, "reviews_create_bad_status", "POST", "/api/v1/reviews/", {"project": pid, "title": "Bad", "code": "RV998", "status": "Bogus"})
    call(sv, "reviews_create_second", "POST", "/api/v1/reviews/", {"project": pid, "title": "Second review", "code": "RV999"})
    call(sv, "reviews_detail", "GET", f"/api/v1/reviews/{rid}/")
    call(sv, "reviews_add_version_empty", "POST", f"/api/v1/reviews/{rid}/versions/", {})
    call(sv, "reviews_add_version", "POST", f"/api/v1/reviews/{rid}/versions/", {"version_id": vid})
    call(sv, "reviews_add_version_again", "POST", f"/api/v1/reviews/{rid}/versions/", {"version_id": vid})
    call(sv, "reviews_add_version_second", "POST", f"/api/v1/reviews/{rid}/versions/", {"version_id": vid2})
    call(sv, "reviews_remove_version", "DELETE", f"/api/v1/reviews/{rid}/versions/{vid2}/")
    call(sv, "reviews_participants_add", "POST", f"/api/v1/reviews/{rid}/participants/", {"user_id": str(lead.id), "role": "Lead"})
    call(sv, "reviews_participants_add_again", "POST", f"/api/v1/reviews/{rid}/participants/", {"user_id": str(lead.id), "role": "Lead"})
    call(sv, "reviews_participants_add_stranger", "POST", f"/api/v1/reviews/{rid}/participants/", {"user_id": str(U.get(email="stranger@example.test").id)})
    call(sv, "reviews_participants_add_artist", "POST", f"/api/v1/reviews/{rid}/participants/", {"user_id": str(artist2.id), "role": "Observer"})
    call(sv, "reviews_comments_empty", "POST", f"/api/v1/reviews/{rid}/comments/", {})
    c = call(sv, "reviews_comments_add", "POST", f"/api/v1/reviews/{rid}/comments/", {"text": "Edge flicker at 1040", "frame_number": 1040, "tags": ["comp"]})
    detail = sv.get(f"/api/v1/reviews/{rid}/").json()
    cid = (detail.get("comments") or [{}])[0].get("id")
    call(sv, "reviews_comments_reply", "POST", f"/api/v1/reviews/{rid}/comments/", {"text": "Fixed in v2", "parent_id": cid})
    call(sv, "reviews_comments_resolve", "POST", f"/api/v1/reviews/{rid}/comments/{cid}/resolve/", {})
    call(sv, "reviews_comments_reopen", "POST", f"/api/v1/reviews/{rid}/comments/{cid}/reopen/", {})
    call(sv, "reviews_notes_add", "POST", f"/api/v1/reviews/{rid}/notes/", {"content": "Keep the grade", "category": "General", "is_pinned": True})
    call(sv, "reviews_annotations_add", "POST", f"/api/v1/reviews/{rid}/annotations/", {"frame_number": 1040, "comment": "circle here", "drawing_coordinates": {"x": 0.4, "y": 0.5}})
    call(ar, "reviews_artist_comment", "POST", f"/api/v1/reviews/{rid}/comments/", {"text": "from artist"})
    call(ar, "reviews_artist_detail", "GET", f"/api/v1/reviews/{rid}/")
    call(sv, "reviews_status_invalid_jump", "POST", f"/api/v1/reviews/{rid}/approve/", {})
    call(ld, "reviews_submit", "POST", f"/api/v1/reviews/{rid}/submit/", {})
    call(sv, "reviews_start_review", "POST", f"/api/v1/reviews/{rid}/start-review/", {})
    call(ld, "reviews_participant_verdict_no_id", "POST", f"/api/v1/reviews/{rid}/participant-verdict/", {"verdict": "Approved"})
    pdet = sv.get(f"/api/v1/reviews/{rid}/").json()
    parts = pdet.get("reviewers") or pdet.get("participants") or []
    lead_part = next((p for p in parts if str(p.get("user_id")) == str(lead.id)), (parts or [{}])[0])
    call(ld, "reviews_participant_verdict", "POST", f"/api/v1/reviews/{rid}/participant-verdict/", {"participant_id": str(lead_part.get("id")), "verdict": "Approved", "notes": "looks good"})
    call(ar2, "reviews_participant_verdict_other_user", "POST", f"/api/v1/reviews/{rid}/participant-verdict/", {"participant_id": str(lead_part.get("id")), "verdict": "Approved"})
    call(ld, "reviews_lead_approve", "POST", f"/api/v1/reviews/{rid}/approve/", {})
    call(sv, "reviews_request_changes", "POST", f"/api/v1/reviews/{rid}/request-changes/", {"notes": "tighten the edge"})
    call(sv, "reviews_status_history_mid", "GET", f"/api/v1/reviews/{rid}/status-history/")
    call(ld, "reviews_resubmit", "POST", f"/api/v1/reviews/{rid}/submit/", {})
    call(sv, "reviews_start_again", "POST", f"/api/v1/reviews/{rid}/start-review/", {})
    call(sv, "reviews_approve", "POST", f"/api/v1/reviews/{rid}/approve/", {"notes": "approved"})
    call(sv, "reviews_detail_after_approve", "GET", f"/api/v1/reviews/{rid}/")
    call(sv, "reviews_status_history", "GET", f"/api/v1/reviews/{rid}/status-history/")
    call(sv, "versions_detail_after_review", "GET", f"/api/v1/versions/{vid}/")
    call(sv, "reviews_close", "POST", f"/api/v1/reviews/{rid}/close/", {})
    call(sv, "reviews_close_again", "POST", f"/api/v1/reviews/{rid}/close/", {})
    call(sv, "reviews_comment_on_closed", "POST", f"/api/v1/reviews/{rid}/comments/", {"text": "late"})
    call(sv, "reviews_list", "GET", f"/api/v1/reviews/?project={pid}")
    call(ar, "reviews_artist_approve", "POST", f"/api/v1/reviews/{rid}/approve/", {})
    # self-approval: the supervisor submits and then tries to approve
    rv2 = call(sv, "reviews_two_create", "POST", "/api/v1/reviews/", {"project": pid, "title": "Self", "code": "RV002", "entity_type": "Shot", "entity_id": sid2}).json()["id"]
    call(sv, "reviews_two_submit", "POST", f"/api/v1/reviews/{rv2}/submit/", {})
    call(sv, "reviews_two_start", "POST", f"/api/v1/reviews/{rv2}/start-review/", {})
    call(sv, "reviews_two_self_approve", "POST", f"/api/v1/reviews/{rv2}/approve/", {})
    call(sv, "reviews_two_reject", "POST", f"/api/v1/reviews/{rv2}/reject/", {"notes": "no"})
    call(sv, "reviews_two_verdict", "POST", f"/api/v1/reviews/{rv2}/verdict/", {"verdict": "Retake", "notes": "redo"})
    call(sv, "reviews_two_archive", "POST", f"/api/v1/reviews/{rv2}/archive/", {})
    call(sv, "reviews_two_archive_restore", "POST", f"/api/v1/reviews/{rv2}/restore/", {})
    call(sv, "reviews_two_delete", "DELETE", f"/api/v1/reviews/{rv2}/")
    # a third review: the supervisor submits, a participant who did not submit gives a verdict, and the supervisor decides Retake
    rv3 = call(sv, "reviews_three_create", "POST", "/api/v1/reviews/", {"project": pid, "title": "Third", "code": "RV003", "entity_type": "Shot", "entity_id": sid2}).json()["id"]
    call(sv, "reviews_three_add_version", "POST", f"/api/v1/reviews/{rv3}/versions/", {"version_id": own_id})
    call(sv, "reviews_three_add_lead", "POST", f"/api/v1/reviews/{rv3}/participants/", {"user_id": str(lead.id), "role": "Lead"})
    call(sv, "reviews_three_submit", "POST", f"/api/v1/reviews/{rv3}/submit/", {})
    call(sv, "reviews_three_start", "POST", f"/api/v1/reviews/{rv3}/start-review/", {})
    p3 = sv.get(f"/api/v1/reviews/{rv3}/").json().get("reviewers") or []
    lead_p3 = next((p for p in p3 if str(p.get("user_id")) == str(lead.id)), (p3 or [{}])[0])
    call(ld, "reviews_three_participant_verdict_bogus", "POST", f"/api/v1/reviews/{rv3}/participant-verdict/", {"participant_id": str(lead_p3.get("id")), "verdict": "Banana"})
    call(ld, "reviews_three_participant_verdict_changes", "POST", f"/api/v1/reviews/{rv3}/participant-verdict/", {"participant_id": str(lead_p3.get("id")), "verdict": "Changes Requested", "notes": "needs work"})
    call(ld, "reviews_three_participant_verdict_rejected", "POST", f"/api/v1/reviews/{rv3}/participant-verdict/", {"participant_id": str(lead_p3.get("id")), "verdict": "Rejected"})
    call(ld, "reviews_three_participant_verdict_empty", "POST", f"/api/v1/reviews/{rv3}/participant-verdict/", {"participant_id": str(lead_p3.get("id"))})
    call(ld, "reviews_three_participant_verdict", "POST", f"/api/v1/reviews/{rv3}/participant-verdict/", {"participant_id": str(lead_p3.get("id")), "verdict": "Approved", "notes": "fine by me"})
    call(sv, "reviews_three_detail_after_participant", "GET", f"/api/v1/reviews/{rv3}/")
    call(sv, "reviews_three_verdict_bogus", "POST", f"/api/v1/reviews/{rv3}/verdict/", {"verdict": "Banana"})
    call(sv, "reviews_three_retake_verdict", "POST", f"/api/v1/reviews/{rv3}/verdict/", {"verdict": "Retake", "notes": "redo the edge"})
    call(sv, "reviews_three_remove_participant", "DELETE", f"/api/v1/reviews/{rv3}/participants/{lead_p3.get('id')}/")
    call(sv, "reviews_archived", "GET", f"/api/v1/reviews/archived/?project={pid}")
    call(sv, "reviews_two_restore", "POST", f"/api/v1/reviews/{rv2}/restore/", {})

    # ------------------------------------------------------------ media
    call(ar, "media_create_empty", "POST", "/api/v1/media/", {})
    call(ar, "media_create_bad_type", "POST", "/api/v1/media/", {"project": pid, "entity_type": "Shot", "entity_id": sid, "media_type": "Bogus"})
    m = call(ar, "media_create", "POST", "/api/v1/media/", {"project": pid, "entity_type": "Shot", "entity_id": sid, "media_type": "Video", "category": "Reference", "file_format": "mov", "source_url": "https://example.test/ref.mov", "preview_url": "https://example.test/ref.mp4", "thumbnail_url": "https://example.test/ref.jpg", "file_size_mb": 120.5, "resolution": "1920x1080"})
    mid = m.json().get("id")
    call(ar, "media_list", "GET", f"/api/v1/media/?project={pid}")
    call(ar, "media_detail", "GET", f"/api/v1/media/{mid}/")
    call(ar, "media_artist_patch", "PATCH", f"/api/v1/media/{mid}/", {"category": "Plate"})
    call(ld, "media_lead_patch", "PATCH", f"/api/v1/media/{mid}/", {"category": "Plate"})
    call(ld, "media_archive", "POST", f"/api/v1/media/{mid}/archive/", {})
    call(ld, "media_archive_restore", "POST", f"/api/v1/media/{mid}/restore/", {})
    call(ld, "media_delete", "DELETE", f"/api/v1/media/{mid}/")
    call(ld, "media_archived", "GET", f"/api/v1/media/archived/?project={pid}")
    call(ld, "media_restore", "POST", f"/api/v1/media/{mid}/restore/", {})

    # ------------------------------------------------------------ workflows
    call(a, "workflows_create_empty", "POST", "/api/v1/workflows/", {})
    nodes = [{"id": "n1", "type": "start", "label": "Start"}, {"id": "n2", "type": "task", "label": "Comp"}, {"id": "n3", "type": "end", "label": "Done"}]
    trans = [{"from": "n1", "to": "n2"}, {"from": "n2", "to": "n3"}]
    w = call(a, "workflows_create", "POST", "/api/v1/workflows/", {"project": pid, "name": "Comp flow", "code": "CF1", "description": "Comp to done", "category": "Production", "department": "Compositing", "nodes": nodes, "transitions": trans, "automation_rules": []})
    wid = w.json().get("id")
    call(a, "workflows_create_duplicate", "POST", "/api/v1/workflows/", {"project": pid, "name": "dup", "code": "cf1"})
    call(a, "workflows_list", "GET", f"/api/v1/workflows/?project={pid}")
    call(a, "workflows_detail", "GET", f"/api/v1/workflows/{wid}/")
    call(a, "workflows_patch", "PATCH", f"/api/v1/workflows/{wid}/", {"description": "Edited"})
    call(a, "workflows_activate", "POST", f"/api/v1/workflows/{wid}/activate/", {})
    call(a, "workflows_deactivate", "POST", f"/api/v1/workflows/{wid}/deactivate/", {})
    call(a, "workflows_simulate", "POST", f"/api/v1/workflows/{wid}/simulate/", {})
    call(a, "workflows_simulate_with_input", "POST", f"/api/v1/workflows/{wid}/simulate/", {"input": {"status": "Approved"}})
    call(a, "workflows_clone", "POST", f"/api/v1/workflows/{wid}/clone/", {})
    call(a, "workflows_clone_again", "POST", f"/api/v1/workflows/{wid}/clone/", {})
    call(a, "workflows_archive", "POST", f"/api/v1/workflows/{wid}/archive/", {})
    call(a, "workflows_archived", "GET", f"/api/v1/workflows/archived/?project={pid}")
    call(a, "workflows_restore", "POST", f"/api/v1/workflows/{wid}/restore/", {})
    call(ld, "workflows_lead_list", "GET", f"/api/v1/workflows/?project={pid}")
    call(ld, "workflows_lead_create", "POST", "/api/v1/workflows/", {"project": pid, "name": "x", "code": "X1"})
    call(ld, "workflows_lead_simulate", "POST", f"/api/v1/workflows/{wid}/simulate/", {})
    call(ar, "workflows_artist_list", "GET", f"/api/v1/workflows/?project={pid}")

    # ------------------------------------------------------------ automations
    call(a, "automations_rules", "GET", "/api/v1/automations/rules/")
    call(a, "automations_rules_create", "POST", "/api/v1/automations/rules/", {"name": "Notify on approve", "trigger": "version.approved"})
    call(a, "automations_rules_create_empty", "POST", "/api/v1/automations/rules/", {})
    rule = call(a, "automations_rules_create_ok", "POST", "/api/v1/automations/rules/", {"name": "Notify on approve", "description": "Tell the lead", "trigger": {"event": "status_changed", "entity_type": "Version", "filters": {"status": "Approved"}}, "conditions": [], "actions": [{"type": "notify", "target": "lead"}], "is_active": True, "required_role": ""})
    rule_id = rule.json().get("id")
    call(a, "automations_rules_after", "GET", "/api/v1/automations/rules/")
    call(a, "automations_rules_detail_ok", "GET", f"/api/v1/automations/rules/{rule_id}/")
    call(a, "automations_rules_patch", "PATCH", f"/api/v1/automations/rules/{rule_id}/", {"is_active": False})
    call(a, "automations_rules_put", "PUT", f"/api/v1/automations/rules/{rule_id}/", {"name": "Renamed", "trigger": {"event": "status_changed", "entity_type": "Version"}, "actions": [], "conditions": []})
    call(sv, "automations_supervisor_create", "POST", "/api/v1/automations/rules/", {"name": "x", "trigger": {"event": "e"}})
    call(a, "automations_rules_delete", "DELETE", f"/api/v1/automations/rules/{rule_id}/")
    call(a, "automations_rules_detail", "GET", "/api/v1/automations/rules/does-not-exist/")
    call(a, "automations_audit_logs", "GET", "/api/v1/automations/audit-logs/")
    call(ar, "automations_artist_rules", "GET", "/api/v1/automations/rules/")
    call(sv, "automations_supervisor_rules", "GET", "/api/v1/automations/rules/")

    # ------------------------------------------------------------ filter probes: one param each (unknown params are silently ignored)
    def probe(prefix, base, params, client):
        call(client, f"{prefix}_baseline", "GET", base)
        for name, value in params:
            call(client, f"{prefix}_by_{name}_{re.sub('[^A-Za-z0-9]+', '', str(value))[:10]}", "GET", f"{base}{'&' if '?' in base else '?'}{name}={value}")

    probe("fp_versions", f"/api/v1/versions/?project_id={pid}", [("status", "Approved"), ("department", "Compositing"), ("entity_type", "Shot"), ("entity_id", sid), ("shot_id", sid), ("asset_id", aid), ("task_id", tid), ("is_published", "true"), ("is_hero", "true"), ("is_archived", "false"), ("artist", artist.id), ("search", "second"), ("nonsense", "1")], ld)
    probe("fp_reviews", f"/api/v1/reviews/?project_id={pid}", [("status", "Closed"), ("entity_type", "Shot"), ("entity_code", "SH0010"), ("entity_id", sid), ("search", "Walk"), ("nonsense", "1")], sv)
    probe("fp_playlists", f"/api/v1/playlists/?project_id={pid}", [("status", "Active"), ("client_only", "true"), ("search", "Dailies"), ("nonsense", "1")], ld)
    probe("fp_media", f"/api/v1/media/?project_id={pid}", [("media_type", "Video"), ("entity_type", "Shot"), ("entity_id", sid), ("nonsense", "1")], ld)
    probe("fp_workflows", f"/api/v1/workflows/?project_id={pid}", [("category", "Production"), ("department", "Compositing"), ("is_active", "true"), ("event_type", "x"), ("search", "Comp"), ("nonsense", "1")], a)

    # ------------------------------------------------------------ the stranger
    call(sg, "stranger_versions", "GET", f"/api/v1/versions/?project={pid}")
    call(sg, "stranger_version_detail", "GET", f"/api/v1/versions/{vid}/")
    call(sg, "stranger_review_detail", "GET", f"/api/v1/reviews/{rid}/")
    call(sg, "stranger_playlists", "GET", f"/api/v1/playlists/?project={pid}")

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_review_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
