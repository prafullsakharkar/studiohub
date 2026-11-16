"""
Review pipeline RP-13 sample capture: notifications beyond reviews (real responses).

C-RP-34 to C-RP-36: a producer's delivery is prepared, signed off by a supervisor, sent by a
coordinator, answered by the client (recorded by the producer) and completed; a second delivery is
signed off and then reopened by the platform when a TD revokes a file it holds; two publish jobs (one
exported, one failed); a milestone completed by the supervisor; reminders for a milestone due
tomorrow and one overdue. Then everyone's inbox (the artist, without ``delivery.view``, sees no
delivery), a kind filter, the unread count and the preferences listing the new kinds. The actions
run through the services the routes call; every read is the real route. Handlers run after commit,
as in a real request (``django_capture_on_commit_callbacks(execute=True)``). Pytest test database
only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_pipeline_notifications.py
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
from pathlib import Path
from types import SimpleNamespace

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
def test_capture_pipeline_notifications(django_user_model, django_capture_on_commit_callbacks):
    from django.core.management import call_command
    from django.db import connection

    from apps.deliveries.services.package import DeliveryService
    from apps.identity.tests.rbac_helpers import grant_permissions
    from apps.notifications.services.reminders import ReminderService
    from apps.production.models import ProjectMembership, Task, Version
    from apps.publishing.models import PublishItem, StorageRoot
    from apps.publishing.services.files import PublishedFileService
    from apps.publishing.services.workflow import JobService
    from apps.scheduling.selectors.notification_sources import ScheduleNotificationSources
    from apps.scheduling.services.milestone import MilestoneService

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    def committed(fn, *args, **kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return fn(*args, **kwargs)

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

    def user(email, *codes):
        found = django_user_model.objects.create_user(email=email, password="RP13-Pass-Word!9")
        grant_permissions(found, *codes)
        return found

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="RP13-Admin-Pass!9")
    deliveries = ("delivery.view", "delivery.create", "delivery.update", "delivery.approve", "delivery.send")
    base = ("project.view", "version.view", "task.view", "publishing.view", "schedule.view")
    producer = user("producer@example.test", *base, *deliveries, "publishing.update", "schedule.manage")
    supervisor = user("supervisor@example.test", *base, *deliveries, "schedule.manage")
    coordinator = user("coordinator@example.test", *base, *deliveries)
    td = user("td@example.test", *base, "publishing.create", "publishing.update", "publishing.revoke")
    artist = user("artist@example.test", *base)  # CR-53: no delivery.view

    def client(who):
        api = APIClient()
        api.force_authenticate(user=who)
        return api

    a = client(admin)
    project = a.post("/api/v1/projects/", {"code": "RPP", "name": "Pipeline notify", "workflow_type": "standard", "type": "Feature Film"}, format="json")
    assert project.status_code == 201, project.content[:300]
    project_id = project.json()["id"]
    for who, role in ((producer, "Producer"), (supervisor, "VFX Supervisor"), (coordinator, "Coordinator"), (td, "TD"), (artist, "Artist")):
        ProjectMembership.objects.create(user=who, project_id=project_id, status="active", role=role)
    StorageRoot.objects.get_or_create(code="PROJECTS", defaults={"name": "Projects"})
    task = Task.objects.create(project_id=project_id, title="Comp", code="RPP_SH010_COMP", assignee=artist)

    def version(code, index):
        return Version.objects.create(project_id=project_id, task=task, artist=artist, code=code, version_number=f"v{index:03d}", version_index=index, status="Approved", is_published=True)

    def register(v, path):
        file, _ = PublishedFileService.register(
            actor=td,
            request=SimpleNamespace(user=td, auth=None),
            version_id=v.pk,
            data={"version_id": str(v.pk), "storage_root": "PROJECTS", "relative_path": path, "size_bytes": 2048, "sha256": f"{len(path):x}".rjust(64, "a")},
        )
        return file

    # A delivery all the way through: prepared, signed off, sent, answered, completed.
    v1 = version("RPP_SH010_V001", 1)
    register(v1, "rpp/sh010/v001/comp.exr")
    first = DeliveryService.create(actor=producer, data={"name": "Turnover 1", "project_id": project_id, "code": "RPP_DEL_001"})
    DeliveryService.add_version(actor=producer, package=first, version_id=v1.pk)
    first, _ = committed(DeliveryService.prepare, actor=producer, package=first)
    first = committed(DeliveryService.sign_off, actor=supervisor, package=first)
    first = committed(DeliveryService.send, actor=coordinator, package=first)
    first = committed(DeliveryService.record_client_answer, actor=producer, package=first, accepted=True)
    committed(DeliveryService.complete, actor=producer, package=first)

    # A second delivery, signed off, then reopened by the platform when the TD revokes its file.
    v2 = version("RPP_SH020_V001", 2)
    plate = register(v2, "rpp/sh020/v001/plate_main.exr")
    second = DeliveryService.create(actor=producer, data={"name": "Turnover 2", "project_id": project_id, "code": "RPP_DEL_002"})
    DeliveryService.add_version(actor=producer, package=second, version_id=v2.pk)
    second, _ = committed(DeliveryService.prepare, actor=producer, package=second)
    committed(DeliveryService.sign_off, actor=supervisor, package=second)
    committed(PublishedFileService.revoke, actor=td, request=SimpleNamespace(user=td, auth=None), file=plate, reason="Wrong grade")

    # Two publish jobs started by the TD on the artist's version: one exported, one failed.
    exported = PublishItem.objects.create(name="Comp export", code="RPP_PUB_001", project_id=project_id, version=v1, dcc_tool="Nuke", status="Exporting", created_by=td)
    failed = PublishItem.objects.create(name="Comp export", code="RPP_PUB_002", project_id=project_id, version=v1, dcc_tool="Nuke", status="Exporting", created_by=td)
    pr = client(producer)
    flow = {}
    flow["complete_export"] = call(pr, "POST", f"/api/v1/publishing/{exported.pk}/complete-export/", {})
    flow["fail_export"] = call(pr, "POST", f"/api/v1/publishing/{failed.pk}/fail/", {"reason": "Render node ran out of disk"})

    # Milestones: one completed by the supervisor, one due tomorrow, one overdue since yesterday.
    today = ScheduleNotificationSources.studio_today()
    done = MilestoneService.create(actor=producer, project=v1.project, data={"name": "Picture lock", "due_date": today + dt.timedelta(days=10)})
    flow["complete_milestone"] = call(client(supervisor), "POST", f"/api/v1/scheduling/milestones/{done.pk}/complete/", {})
    MilestoneService.create(actor=producer, project=done.project, data={"name": "Final turnover", "due_date": today + dt.timedelta(days=1)})
    MilestoneService.create(actor=producer, project=done.project, data={"name": "Temp mix", "due_date": today - dt.timedelta(days=1)})
    ReminderService.run()

    for name, who in (("producer", producer), ("supervisor", supervisor), ("coordinator", coordinator), ("td", td), ("artist", artist)):
        flow[f"{name}_list"] = call(client(who), "GET", "/api/v1/notifications/?page_size=50")
    flow["producer_list_kind_milestone_due"] = call(pr, "GET", "/api/v1/notifications/?kind=milestone_due")
    flow["producer_unread_count"] = call(pr, "GET", "/api/v1/notifications/unread-count/")
    flow["producer_preferences"] = call(pr, "GET", "/api/v1/notifications/preferences/")
    flow["producer_mute_delivery_status"] = call(pr, "PUT", "/api/v1/notifications/preferences/", {"muted_kinds": ["delivery_status", "milestone_due"]})

    for key in ("complete_export", "fail_export", "complete_milestone"):
        assert flow[key]["status"] == 200, (key, flow[key])
    kinds = {row["kind"] for key in flow if key.endswith("_list") for row in flow[key]["body"]["results"]}
    assert kinds == {"delivery_status", "delivery_client_answer", "publish_finished", "published_file_revoked", "milestone_due", "milestone_completed"}, kinds
    assert all(row["target"]["type"] != "delivery" for row in flow["artist_list"]["body"]["results"])
    OUT.joinpath("notifications", "_pipeline_notifications_flow.json").write_text(json.dumps(flow, indent=2, sort_keys=True) + "\n")
