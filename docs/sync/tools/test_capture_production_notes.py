"""
Review pipeline RP-2 sample capture: project notes with replies, links, a task and a status (real responses).

C-RP-07 to C-RP-13: a thread on several records and a task, the old single-record body, the refusals, replies
(also to a reply), the thread list and its filters, the detail, edits by the author and by someone who may edit
notes, the status by the task's assignee, deletes, and a member bound to a show. Pytest test database only, inside
a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_production_notes.py
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


def call(client, method, path, data=None):
    send = getattr(client, method.lower())
    resp = send(path, data=data, format="json") if data is not None else send(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Allow") if resp.get(h)}
    return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "headers": headers, "body": clean(body)}


@pytest.mark.django_db
def test_capture_production_notes(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.tests.rbac_helpers import grant_permissions
    from apps.production.models import ProjectMembership, Show

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="RP2-Admin-Pass!9")
    supervisor = django_user_model.objects.create_user(email="supervisor@example.test", password="RP2-Sup-Pass!9")
    artist = django_user_model.objects.create_user(email="artist@example.test", password="RP2-Artist-Pass!9")
    lead = django_user_model.objects.create_user(email="lead@example.test", password="RP2-Lead-Pass!9")
    bound = django_user_model.objects.create_user(email="bound@example.test", password="RP2-Bound-Pass!9")
    grant_permissions(supervisor, "project.view", "note.create", "note.update", "note.delete", "task.view")
    for user in (artist, lead, bound):
        grant_permissions(user, "project.view", "note.create", "task.view")

    def client(user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    a, sup, art, ld = client(admin), client(supervisor), client(artist), client(lead)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make("/api/v1/projects/", {"code": "RPN", "name": "Notes", "workflow_type": "standard", "type": "Feature Film"})
    other = make("/api/v1/projects/", {"code": "RPX", "name": "Elsewhere", "workflow_type": "standard", "type": "Feature Film"})
    pid = project["id"]
    for user in (supervisor, artist, lead):
        make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(user.id), "role": "Artist"})
    show = Show.objects.create(project_id=pid, code="RPN_SHOW", name="Show A")
    ProjectMembership.objects.create(user=bound, project_id=pid, status="active", role="Artist", show=show)

    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPN_SQ010", "name": "Opening"})
    shot = make("/api/v1/shots/", {"project": pid, "sequence_id": seq["id"], "code": "RPN_SH0010", "name": "Hero walk"})
    shot2 = make("/api/v1/shots/", {"project": pid, "sequence_id": seq["id"], "code": "RPN_SH0020", "name": "Turn"})
    asset = make("/api/v1/assets/", {"project": pid, "code": "RPN_CHR_HERO", "name": "Hero", "category": "Character"})
    task = make("/api/v1/tasks/", {"project": pid, "shot": shot["id"], "title": "Comp", "code": "RPN_T_COMP", "department": "Comp", "assignee": str(artist.id)})
    version = make("/api/v1/versions/", {"project": pid, "shot": shot["id"], "task": task["id"], "code": "RPN_SH0010_comp_v001"})
    oseq = make("/api/v1/sequences/", {"project": other["id"], "code": "RPX_SQ010", "name": "Other"})
    foreign = make("/api/v1/shots/", {"project": other["id"], "sequence_id": oseq["id"], "code": "RPX_SH0010", "name": "Not here"})

    notes = f"/api/organizations/projects/{pid}/notes/"
    shot_link = {"entity_type": "Shot", "entity_id": shot["id"]}
    version_link = {"entity_type": "Version", "entity_id": version["id"]}
    flow: dict[str, dict] = {  # type: ignore[assignment]
        "ids": {
            "project": pid,
            "shot": shot["id"],
            "shot2": shot2["id"],
            "asset": asset["id"],
            "sequence": seq["id"],
            "task": task["id"],
            "version": version["id"],
            "foreign_shot": foreign["id"],
            "supervisor": str(supervisor.id),
            "artist": str(artist.id),
            "lead": str(lead.id),
        }
    }

    # C-RP-07: several records and a task; the code and name sent are ignored, the status too.
    flow["create_thread"] = call(sup, "POST", notes, {"subject": "Edge is soft", "body": "Left edge on the matte.", "category": "Supervisor Note", "links": [shot_link, version_link], "task_id": task["id"], "entity_code": "TYPED", "status": "Closed"})
    thread = flow["create_thread"]["body"]["id"]
    # What the shot and asset Notes tabs send today (one record, with its code and name).
    flow["create_old_body"] = call(art, "POST", notes, {"subject": "Fix the rig", "category": "Pipeline Notice", "entity_type": "Asset", "entity_id": asset["id"], "entity_code": "RPN_CHR_HERO", "entity_name": "Hero"})
    flow["create_on_project"] = call(art, "POST", notes, {"subject": "Delivery spec"})
    flow["create_other_project_400"] = call(sup, "POST", notes, {"subject": "x", "links": [{"entity_type": "Shot", "entity_id": foreign["id"]}]})
    flow["create_bad_id_400"] = call(sup, "POST", notes, {"subject": "x", "links": [{"entity_type": "Shot", "entity_id": "SH0010"}]})
    flow["create_too_many_400"] = call(sup, "POST", notes, {"subject": "x", "links": [shot_link] * 21})
    flow["create_task_elsewhere_400"] = call(sup, "POST", notes, {"subject": "x", "task_id": foreign["id"]})
    flow["create_empty_400"] = call(sup, "POST", notes, {})

    # C-RP-11: replies, also to a reply (stored on the root); a blank one.
    flow["reply_by_artist"] = call(art, "POST", f"{notes}{thread}/replies/", {"body": "Softened, see v002."})
    reply = flow["reply_by_artist"]["body"]["id"]
    flow["reply_by_lead"] = call(ld, "POST", f"{notes}{thread}/replies/", {"body": "Looks right to me."})
    flow["reply_to_reply"] = call(sup, "POST", f"{notes}{reply}/replies/", {"body": "Agreed."})
    flow["reply_blank_400"] = call(art, "POST", f"{notes}{thread}/replies/", {"body": "  "})

    # C-RP-09: threads only, and the filters.
    flow["list"] = call(art, "GET", notes)
    flow["list_by_shot"] = call(art, "GET", f"{notes}?entity_type=Shot&entity_id={shot['id']}")
    flow["list_by_version"] = call(art, "GET", f"{notes}?entity_type=Version&entity_id={version['id']}")
    flow["list_by_asset"] = call(art, "GET", f"{notes}?entity_type=Asset&entity_id={asset['id']}")
    flow["list_by_other_shot"] = call(art, "GET", f"{notes}?entity_type=Shot&entity_id={shot2['id']}")
    flow["list_by_task"] = call(art, "GET", f"{notes}?task_id={task['id']}")
    flow["list_open"] = call(art, "GET", f"{notes}?status=Open")
    flow["list_unknown_type"] = call(art, "GET", f"{notes}?entity_type=Spaceship")

    # C-RP-10: one thread with its replies; a reply's id answers with its thread.
    flow["detail"] = call(art, "GET", f"{notes}{thread}/")
    flow["detail_by_reply_id"] = call(art, "GET", f"{notes}{reply}/")
    flow["detail_unknown_404"] = call(art, "GET", f"{notes}00000000-0000-0000-0000-000000000000/")
    # A thread no one else has replied to yet (its author may still delete it).
    flow["detail_on_project"] = call(art, "GET", f"{notes}{flow['create_on_project']['body']['id']}/")
    # What the Notes tab reads to know whether the caller is the task's assignee (who may set the status).
    flow["task_detail"] = call(art, "GET", f"/api/v1/tasks/{task['id']}/")

    # C-RP-12: edits.
    flow["patch_by_author"] = call(sup, "PATCH", f"{notes}{thread}/", {"subject": "Edge is soft (left)", "links": [shot_link, version_link, {"entity_type": "Asset", "entity_id": asset["id"]}]})
    flow["patch_by_other_403"] = call(art, "PATCH", f"{notes}{thread}/", {"body": "mine now"})
    flow["patch_task_cleared"] = call(sup, "PATCH", f"{notes}{flow['create_on_project']['body']['id']}/", {"task_id": None, "category": "Turnover Requirement"})
    flow["patch_reply_body"] = call(art, "PATCH", f"{notes}{reply}/", {"body": "Softened, see v002 and v003."})
    flow["patch_reply_links_400"] = call(art, "PATCH", f"{notes}{reply}/", {"links": [shot_link]})

    # C-RP-13: status by the task's assignee, by someone with neither right, a reply's, and back to Open.
    flow["status_by_assignee"] = call(art, "POST", f"{notes}{thread}/status/", {"status": "Addressed"})
    flow["status_by_other_403"] = call(ld, "POST", f"{notes}{flow['create_old_body']['body']['id']}/status/", {"status": "Closed"})
    flow["status_closed_by_supervisor"] = call(sup, "POST", f"{notes}{thread}/status/", {"status": "Closed"})
    flow["status_reopened"] = call(sup, "POST", f"{notes}{thread}/status/", {"status": "Open"})
    flow["status_reply_400"] = call(sup, "POST", f"{notes}{reply}/status/", {"status": "Closed"})
    flow["status_unknown_400"] = call(sup, "POST", f"{notes}{thread}/status/", {"status": "Lost"})

    # C-RP-13: deletes. The author may not once others replied; someone with note.delete may.
    on_project = flow["create_on_project"]["body"]["id"]
    flow["delete_reply_by_author"] = call(ld, "DELETE", f"{notes}{flow['reply_by_lead']['body']['id']}/")
    call(ld, "POST", f"{notes}{on_project}/replies/", {"body": "Which spec?"})
    flow["delete_by_author_after_others_replied_403"] = call(art, "DELETE", f"{notes}{on_project}/")
    flow["delete_own_note"] = call(art, "DELETE", f"{notes}{flow['create_old_body']['body']['id']}/")
    flow["delete_by_supervisor"] = call(sup, "DELETE", f"{notes}{thread}/")
    flow["detail_after_delete_404"] = call(art, "GET", f"{notes}{thread}/")
    flow["list_after_deletes"] = call(art, "GET", notes)

    # Members bound to a show (or a department, a client, a vendor) do not reach the notes routes.
    flow["show_bound_list_404"] = call(client(bound), "GET", notes)

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_notes_flow.json").write_text(json.dumps(flow, indent=2, sort_keys=True) + "\n")
