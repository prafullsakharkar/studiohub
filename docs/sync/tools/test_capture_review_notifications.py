"""
Review pipeline RP-11 sample capture: review notifications, client-visible comments and preferences
(real responses).

C-RP-28 to C-RP-30: a review holding the artist's version; a lead asks a supervisor and a client for a
verdict; the client and the studio comment (one comment internal); the supervisor's participant verdict;
the supervisor approves. Then the artist's, the lead's, the supervisor's and the client's inboxes, the
review as the client and as the lead see it, the preferences (read, save, refusals) and a muted kind.
Handlers run after commit, as in a real request (``django_capture_on_commit_callbacks(execute=True)``).
Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_review_notifications.py
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
def test_capture_review_notifications(django_user_model, django_capture_on_commit_callbacks):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.tests.rbac_helpers import grant_permissions
    from apps.production.models import ProjectMembership, ReviewParticipant

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

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

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="RP11-Admin-Pass!9")
    lead = django_user_model.objects.create_user(email="lead@example.test", password="RP11-Lead-Pass!9")
    supervisor = django_user_model.objects.create_user(email="supervisor@example.test", password="RP11-Sup-Pass!9")
    artist = django_user_model.objects.create_user(email="artist@example.test", password="RP11-Artist-Pass!9")
    client_user = django_user_model.objects.create_user(email="client@example.test", password="RP11-Client-Pass!9")
    reader = ("project.view", "version.view", "review.view", "task.view")
    grant_permissions(lead, *reader, "review.create", "review.update", "version.update")
    grant_permissions(supervisor, *reader, "review.update", "review.approve")
    grant_permissions(artist, *reader)
    grant_permissions(client_user, *reader, "review.update")

    def client(user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    a, ld, sup, art, cli = client(admin), client(lead), client(supervisor), client(artist), client(client_user)

    def make(api, path, body):
        resp = api.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make(a, "/api/v1/projects/", {"code": "RPR", "name": "Review notify", "workflow_type": "standard", "type": "Feature Film"})
    for user, role in ((lead, "Lead"), (supervisor, "VFX Supervisor"), (artist, "Artist")):
        ProjectMembership.objects.create(user=user, project_id=project["id"], status="active", role=role)
    ProjectMembership.objects.create(user=client_user, project_id=project["id"], status="active", role="Client", client_id="client-1")
    seq = make(a, "/api/v1/sequences/", {"project": project["id"], "code": "RPR_SQ010", "name": "Opening"})
    shot = make(a, "/api/v1/shots/", {"project": project["id"], "sequence_id": seq["id"], "code": "RPR_SH010", "name": "Hero walk"})
    version = make(a, "/api/v1/versions/", {"project": project["id"], "shot": shot["id"], "code": "RPR_SH010_comp_v001", "artist": str(artist.id), "status": "Pending Review"})
    review = make(ld, "/api/v1/reviews/", {"project": project["id"], "title": "Dailies", "code": "RPR_DAILIES", "entity_type": "Shot", "entity_id": shot["id"], "entity_code": shot["code"]})
    base = f"/api/v1/reviews/{review['id']}/"
    flow: dict[str, dict] = {}  # type: ignore[assignment]
    # Statuses that are not decisions tell nobody (Q-RP-50).
    flow["review_submit"] = call(ld, "POST", f"{base}submit/", {})
    flow["review_start"] = call(ld, "POST", f"{base}start-review/", {})

    # C-RP-28: the version on the review; the supervisor and the client asked for a verdict.
    flow["review_add_version"] = call(ld, "POST", f"{base}versions/", {"version_id": version["id"]})
    flow["review_add_participant_supervisor"] = call(ld, "POST", f"{base}participants/", {"user_id": str(supervisor.id), "role": "VFX Supervisor"})
    flow["review_add_participant_client"] = call(ld, "POST", f"{base}participants/", {"user_id": str(client_user.id), "role": "Client"})

    # C-RP-29: the client comments (asks for internal, is stored client-visible); the lead replies in the
    # open and internally; an internal thread of its own.
    flow["client_comment_forced_visible"] = call(cli, "POST", f"{base}comments/", {"text": "Can the walk be slower?", "version_id": version["id"], "is_client_visible": False})
    thread = flow["client_comment_forced_visible"]["body"]["id"]
    flow["lead_reply_visible"] = call(ld, "POST", f"{base}comments/", {"text": "Yes, in v002.", "parent_id": thread})
    flow["lead_reply_internal"] = call(ld, "POST", f"{base}comments/", {"text": "Budget is tight for this.", "parent_id": thread, "is_client_visible": False})
    flow["lead_comment_internal"] = call(ld, "POST", f"{base}comments/", {"text": "Studio only: check the edge.", "version_id": version["id"], "is_client_visible": False})
    internal = flow["lead_comment_internal"]["body"]["id"]
    flow["client_resolves_internal_404"] = call(cli, "POST", f"{base}comments/{internal}/resolve/")
    flow["client_replies_internal_404"] = call(cli, "POST", f"{base}comments/", {"text": "?", "parent_id": internal})
    flow["review_detail_as_client"] = call(cli, "GET", base)
    flow["review_detail_as_lead"] = call(ld, "GET", base)

    # C-RP-28: the supervisor's participant verdict, then the decision.
    participant = ReviewParticipant.objects.get(review_id=review["id"], user=supervisor)
    flow["supervisor_participant_verdict"] = call(sup, "POST", f"{base}participant-verdict/", {"participant_id": str(participant.id), "verdict": "Approved"})
    flow["supervisor_approves"] = call(sup, "POST", f"{base}approve/", {})

    inbox = "/api/v1/notifications/"
    flow["artist_list"] = call(art, "GET", inbox)
    flow["artist_list_kind_review_decision"] = call(art, "GET", f"{inbox}?kind=review_decision")
    flow["lead_list"] = call(ld, "GET", inbox)
    flow["supervisor_list"] = call(sup, "GET", inbox)
    flow["client_list"] = call(cli, "GET", inbox)

    # C-RP-30: preferences.
    prefs = f"{inbox}preferences/"
    flow["preferences_default"] = call(art, "GET", prefs)
    flow["preferences_save"] = call(art, "PUT", prefs, {"muted_kinds": ["review_comment", "task_status", "review_comment"]})
    flow["preferences_after_save"] = call(art, "GET", prefs)
    flow["preferences_unmutable_400"] = call(art, "PUT", prefs, {"muted_kinds": ["note_mention"]})
    flow["preferences_unknown_400"] = call(art, "PUT", prefs, {"muted_kinds": ["spaceship"]})
    flow["preferences_signed_out_401"] = call(APIClient(), "GET", prefs)
    # A muted kind writes nothing: another comment on the artist's version.
    flow["lead_comment_while_muted"] = call(ld, "POST", f"{base}comments/", {"text": "One more pass on the edge.", "version_id": version["id"]})
    flow["artist_unread_count_while_muted"] = call(art, "GET", f"{inbox}unread-count/")

    OUT.joinpath("notifications").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("notifications", "_review_notifications_flow.json").write_text(json.dumps(flow, indent=2, sort_keys=True) + "\n")
