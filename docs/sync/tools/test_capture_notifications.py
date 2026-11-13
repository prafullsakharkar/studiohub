"""
Review pipeline RP-6 sample capture: in-app notifications and note mentions (real responses).

C-RP-23 to C-RP-25: a task given to an artist, a note on the artist's version that mentions a
supervisor, a reply that mentions the artist, a status change on the note, a version and a task
status change, a review movie that failed and one that is ready; then the artist's inbox, its
filters, the unread count, read, unread, read-all with and without ``before``, someone else's row,
a refused mention, and the lead's inbox. Handlers run after commit, as in a real request
(``django_capture_on_commit_callbacks(execute=True)``). Pytest test database only, inside a
rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_notifications.py
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return EMAIL.sub("user@example.test", v)
    return v


@pytest.mark.django_db
def test_capture_notifications(django_user_model, django_capture_on_commit_callbacks, settings, tmp_path):
    from django.core.management import call_command
    from django.db import connection
    from django.utils import timezone

    from apps.identity.tests.rbac_helpers import grant_permissions
    from apps.production.models import ProjectMembership, ReviewMedia
    from apps.production.services.review_media import ReviewMediaService
    from apps.production.transcode import ffmpeg as commands

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))
    settings.MEDIA_ROOT = tmp_path

    def call(client, method, path, data=None):
        send = getattr(client, method.lower())
        with django_capture_on_commit_callbacks(execute=True):
            resp = send(path, data=data, format="json") if data is not None else send(path)
        try:
            body = resp.json()
        except Exception:
            body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
        headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Allow") if resp.get(h)}
        return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "headers": headers, "body": clean(body)}

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="RP6-Admin-Pass!9")
    lead = django_user_model.objects.create_user(email="lead@example.test", password="RP6-Lead-Pass!9")
    supervisor = django_user_model.objects.create_user(email="supervisor@example.test", password="RP6-Sup-Pass!9")
    artist = django_user_model.objects.create_user(email="artist@example.test", password="RP6-Artist-Pass!9")
    outsider = django_user_model.objects.create_user(email="outsider@example.test", password="RP6-Out-Pass!9")
    narrowed = django_user_model.objects.create_user(email="comp@example.test", password="RP6-Comp-Pass!9")
    former = django_user_model.objects.create_user(email="former@example.test", password="RP6-Former-Pass!9")
    member = ("project.view", "note.create", "task.view", "version.view")
    grant_permissions(lead, *member, "note.update", "task.create", "task.update", "version.update", "version.publish")
    grant_permissions(supervisor, *member, "note.update")
    grant_permissions(artist, *member)
    grant_permissions(outsider, *member)
    grant_permissions(narrowed, *member)
    grant_permissions(former, *member)

    def client(user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    a, ld, sup, art = client(admin), client(lead), client(supervisor), client(artist)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make("/api/v1/projects/", {"code": "RPN", "name": "Notify", "workflow_type": "standard", "type": "Feature Film"})
    for user, role in ((lead, "Lead"), (supervisor, "VFX Supervisor"), (artist, "Artist")):
        ProjectMembership.objects.create(user=user, project_id=project["id"], status="active", role=role)
    # Members the mention picker leaves out: one bound to a department, one who left.
    ProjectMembership.objects.create(user=narrowed, project_id=project["id"], status="active", role="Artist", department="Comp")
    ProjectMembership.objects.create(user=former, project_id=project["id"], status="inactive", role="Artist")
    seq = make("/api/v1/sequences/", {"project": project["id"], "code": "RPN_SQ010", "name": "Opening"})
    shot = make("/api/v1/shots/", {"project": project["id"], "sequence_id": seq["id"], "code": "RPN_SH010", "name": "Hero walk"})
    notes = f"/api/organizations/projects/{project['id']}/notes/"
    flow: dict[str, dict] = {}  # type: ignore[assignment]

    # C-RP-24: a task given to the artist; their version of it.
    flow["task_create_with_assignee"] = call(ld, "POST", "/api/v1/tasks/", {"project": project["id"], "entity_type": "Shot", "entity_id": shot["id"], "title": "Comp", "code": "RPN_T1", "department": "Comp", "assignee": str(artist.id), "status": "In Progress"})
    task = flow["task_create_with_assignee"]["body"]
    version = make("/api/v1/versions/", {"project": project["id"], "shot": shot["id"], "task": task["id"], "code": "RPN_SH010_comp_v001", "artist": str(artist.id), "status": "Pending Review"})

    # C-RP-25: a note on the version and the task that mentions the supervisor; a refused mention.
    flow["note_create_with_mention"] = call(ld, "POST", notes, {"subject": "Edge is soft", "body": "Left side of the frame.", "task_id": task["id"], "links": [{"entity_type": "Version", "entity_id": version["id"]}], "mention_ids": [str(supervisor.id)]})
    thread = flow["note_create_with_mention"]["body"]["id"]
    flow["note_create_mention_refused_400"] = call(ld, "POST", notes, {"subject": "Nope", "mention_ids": [str(outsider.id)]})
    flow["note_create_mention_narrowed_400"] = call(ld, "POST", notes, {"subject": "Nope", "mention_ids": [str(narrowed.id)]})
    flow["note_create_mention_former_400"] = call(ld, "POST", notes, {"subject": "Nope", "mention_ids": [str(former.id)]})
    flow["members_list"] = call(ld, "GET", f"/api/organizations/projects/{project['id']}/members/")
    flow["reply_with_mention"] = call(sup, "POST", f"{notes}{thread}/replies/", {"body": "Agreed, please fix.", "mention_ids": [str(artist.id)]})
    flow["note_patch_adds_mention"] = call(ld, "PATCH", f"{notes}{thread}/", {"mention_ids": [str(supervisor.id), str(artist.id)]})
    flow["note_status_by_assignee"] = call(art, "POST", f"{notes}{thread}/status/", {"status": "Addressed"})
    flow["note_detail"] = call(art, "GET", f"{notes}{thread}/")
    flow["note_list"] = call(art, "GET", notes)

    # C-RP-24: a version and a task status change by the lead.
    flow["version_status_retake"] = call(ld, "PATCH", f"/api/v1/versions/{version['id']}/", {"status": "Retake"})
    flow["task_status_pending_review"] = call(ld, "PATCH", f"/api/v1/tasks/{task['id']}/", {"status": "Pending Review"})

    # C-RP-24: review movies the artist uploaded, one failed and one ready (the worker's side, called directly).
    def media(status):
        return ReviewMedia.objects.create(project_id=project["id"], version_id=version["id"], kind="movie", status=status, source_name="clip.mov", queued_at=timezone.now(), started_at=timezone.now(), created_by=artist)

    with django_capture_on_commit_callbacks(execute=True):
        ReviewMediaService._fail(media("processing"), ReviewMedia.ErrorCode.TRANSCODE_FAILED)
    ready = media("processing")
    (tmp_path / ready.directory).mkdir(parents=True)
    probe = commands.parse_probe(json.dumps({"streams": [{"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080, "avg_frame_rate": "24/1", "r_frame_rate": "24/1", "duration": "1", "nb_read_packets": "24"}], "format": {"duration": "1"}}), kind="movie")
    with django_capture_on_commit_callbacks(execute=True):
        ReviewMediaService._finish(ready, probe, {"proxy": "proxy.mp4", "thumbnail": "thumbnail.jpg", "filmstrip": "filmstrip.jpg"})

    # C-RP-23: the artist's inbox.
    base = "/api/v1/notifications/"
    flow["artist_list"] = call(art, "GET", base)
    flow["artist_unread_count"] = call(art, "GET", f"{base}unread-count/")
    flow["artist_list_kind_version_status"] = call(art, "GET", f"{base}?kind=version_status")
    flow["artist_list_project"] = call(art, "GET", f"{base}?project_id={project['id']}&page_size=2")
    flow["artist_list_unknown_kind"] = call(art, "GET", f"{base}?kind=spaceship")
    rows = flow["artist_list"]["body"]["results"]
    first, oldest = rows[0]["id"], rows[-1]["id"]
    flow["artist_read_one"] = call(art, "POST", f"{base}{first}/read/")
    flow["artist_unread_one"] = call(art, "POST", f"{base}{first}/unread/")
    flow["artist_read_all_before_oldest"] = call(art, "POST", f"{base}read-all/", {"before": rows[-1]["created_at"]})
    flow["artist_list_unread"] = call(art, "GET", f"{base}?unread=true")
    flow["artist_read_all"] = call(art, "POST", f"{base}read-all/", {})
    flow["artist_unread_count_after"] = call(art, "GET", f"{base}unread-count/")
    flow["artist_list_read"] = call(art, "GET", f"{base}?unread=false&page_size=3")
    flow["lead_reads_artists_row_404"] = call(ld, "POST", f"{base}{oldest}/read/")
    flow["unknown_row_404"] = call(art, "POST", f"{base}00000000-0000-0000-0000-000000000000/read/")
    flow["read_all_bad_before_400"] = call(art, "POST", f"{base}read-all/", {"before": "yesterday"})

    # The lead's and the supervisor's inboxes (the note's author; the mentioned).
    flow["lead_list"] = call(ld, "GET", base)
    flow["supervisor_list"] = call(sup, "GET", base)
    flow["signed_out_401"] = call(APIClient(), "GET", base)

    OUT.joinpath("notifications").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("notifications", "_notifications_flow.json").write_text(json.dumps(flow, indent=2, sort_keys=True) + "\n")
