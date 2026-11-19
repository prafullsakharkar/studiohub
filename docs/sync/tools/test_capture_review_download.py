"""
Review pipeline RP-23 sample capture: downloading a review copy (real responses, real ffmpeg).

C-RP-56: the project's ``review_downloads`` (``internal`` by default, ``everyone``, ``nobody``, a bad
value), ``download_url`` on a version's copy as a studio member and as a client member in a review
under each value, the download's headers for a movie and a still, a link refused once the project
says ``nobody``, a playback token used for ``download``. C-RP-57: the audit row of a download, read
from the audit list. Built-in roles from ``init_platform``. Pytest test database only, rolled back;
MEDIA_ROOT is a temporary folder.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_review_download.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
TOKEN = re.compile(r"token=[^\"&\s]+")
#: the download's headers a client relies on
HEADERS = ("Content-Type", "Content-Disposition", "Cache-Control", "X-Content-Type-Options")


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        # Signed links expire; a sample keeps their shape, not a working token.
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


@pytest.mark.django_db
def test_capture_review_download(
    django_user_model, settings, tmp_path, django_capture_on_commit_callbacks, monkeypatch
):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Profile, Role, UserRole
    from apps.production.models import ProjectMembership, ReviewMedia
    from apps.production.services import review_media as service_module
    from apps.production.services.review_media import ReviewMediaService

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    devnull = open(os.devnull, "w")  # noqa: SIM115
    call_command("init_platform", stdout=devnull, stderr=devnull)
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    queued: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: queued.append(str(media_id)))

    def call(client, method, path, data=None, multipart=False):
        send = getattr(client, method.lower())
        if data is not None:
            resp = send(path, data=data, format="multipart" if multipart else "json")
        else:
            resp = send(path)
        return {
            "request": {"method": method, "path": TOKEN.sub("token=SAMPLE", path), "body": data},
            "status": resp.status_code,
            "body": clean(resp.json()),
        }

    def fetch(path, **headers):
        """A followed link: its status, the headers that matter and how many bytes came."""
        resp = APIClient().get(path, **headers)
        size = len(b"".join(resp.streaming_content) if resp.streaming else resp.content)
        return {
            "request": {"method": "GET", "path": TOKEN.sub("token=SAMPLE", path)},
            "status": resp.status_code,
            "headers": {name: resp[name] for name in HEADERS if name in resp},
            "bytes": size,
        }

    def user(email, role_code=None):
        u = django_user_model.objects.create_user(email=email, password="RP23-Pass-Word!9")
        first = email.split("@")[0].title()
        Profile.objects.update_or_create(
            user=u,
            defaults={
                "first_name": first,
                "last_name": "Example",
                "display_name": f"{first} Example",
            },
        )
        if role_code:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role_code))
        return u

    def client(u):
        api = APIClient()
        api.force_authenticate(user=u)
        return api

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP23-Admin-Pass!9"
    )
    supervisor = user("supervisor@example.test", "vfx-supervisor")
    client_user = user("client@example.test", "artist")
    a = client(admin)

    def make(path, body, **kwargs):
        resp = a.post(path, body, format=kwargs.get("format", "json"))
        assert resp.status_code in (200, 201, 202), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make(
        "/api/v1/projects/",
        {
            "code": "RDL",
            "name": "Review downloads",
            "workflow_type": "standard",
            "type": "Feature Film",
        },
    )
    pid = project["id"]
    for u, extra in (
        (supervisor, {"role": "VFX Supervisor"}),
        (client_user, {"role": "Client", "client_id": "client-1"}),
    ):
        ProjectMembership.objects.create(user=u, project_id=pid, status="active", **extra)
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RDL_SQ010", "name": "Opening"})
    shot = make(
        "/api/v1/shots/",
        {"project": pid, "sequence_id": seq["id"], "code": "RDL_SH0010", "name": "Hero walk"},
    )
    version = make(
        "/api/v1/versions/", {"project": pid, "shot": shot["id"], "code": "RDL_SH0010_comp_v003"}
    )
    still = make(
        "/api/v1/versions/", {"project": pid, "shot": shot["id"], "code": "RDL_SH0010_frame_v001"}
    )
    review = make(
        "/api/v1/reviews/",
        {
            "project": pid,
            "title": "Client dailies",
            "code": "RDL_DAILIES",
            "entity_type": "Shot",
            "entity_id": shot["id"],
            "entity_code": shot["code"],
        },
    )
    make(f"/api/v1/reviews/{review['id']}/versions/", {"version_id": version["id"]})
    make(
        f"/api/v1/reviews/{review['id']}/participants/",
        {"user_id": str(client_user.id), "role": "Client"},
    )

    gen = tmp_path / "gen"
    gen.mkdir()
    clip, frame = gen / "comp_v003.mov", gen / "frame_v001.png"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=24", "-frames:v", "48",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", str(clip)],
        check=True,
    )  # fmt: skip
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=24", "-frames:v", "1",
         "-y", str(frame)],
        check=True,
    )  # fmt: skip
    for row, path in ((version, clip), (still, frame)):
        with django_capture_on_commit_callbacks(execute=True):
            made = make(
                f"/api/v1/versions/{row['id']}/review-media/",
                {"file": SimpleUploadedFile(path.name, path.read_bytes())},
                format="multipart",
            )
        assert ReviewMediaService.process(made["id"]) == ReviewMedia.Status.READY

    sup, cli = client(supervisor), client(client_user)
    p, v, s = (
        f"/api/v1/projects/{pid}/",
        f"/api/v1/versions/{version['id']}/",
        f"/api/v1/versions/{still['id']}/",
    )
    flow: dict[str, dict] = {}

    # C-RP-56 under `internal`, the default: the studio may download, the client only plays.
    flow["project_default"] = call(a, "GET", p)
    flow["version_as_studio"] = call(sup, "GET", v)
    flow["version_as_client"] = call(cli, "GET", v)
    studio_links = sup.get(v).json()["review_media"]
    flow["download_movie"] = fetch(studio_links["download_url"], REMOTE_ADDR="10.20.30.40")
    flow["play_movie"] = fetch(studio_links["proxy_url"], HTTP_RANGE="bytes=0-99")
    media_id = studio_links["id"]
    flow["download_with_playback_token_404"] = fetch(
        f"/api/v1/review-media/{media_id}/download/?{studio_links['proxy_url'].split('?')[1]}"
    )
    flow["version_still_as_studio"] = call(sup, "GET", s)
    flow["download_still"] = fetch(sup.get(s).json()["review_media"]["download_url"])

    # C-RP-57: the download, as the audit list shows it.
    flow["audit_of_download"] = call(
        a, "GET", f"/api/v1/audit/?search={version['id']}&action=EXPORT"
    )

    # `everyone`: the client in the review may download too.
    flow["project_everyone_200"] = call(a, "PATCH", p, {"review_downloads": "everyone"})
    flow["version_as_client_everyone"] = call(cli, "GET", v)
    flow["download_as_client"] = fetch(cli.get(v).json()["review_media"]["download_url"])

    # `nobody`: no link, and a link given before is refused.
    flow["project_nobody_200"] = call(a, "PATCH", p, {"review_downloads": "nobody"})
    flow["version_as_studio_nobody"] = call(sup, "GET", v)
    flow["download_after_nobody_404"] = fetch(studio_links["download_url"])
    flow["project_bad_value_400"] = call(a, "PATCH", p, {"review_downloads": "clients"})

    expected = {
        "download_with_playback_token_404": 404,
        "download_after_nobody_404": 404,
        "project_bad_value_400": 400,
        "play_movie": 206,
    }
    for name, entry in flow.items():
        assert entry["status"] == expected.get(name, 200), (
            name,
            entry["status"],
            entry.get("body"),
        )
    assert flow["project_default"]["body"]["review_downloads"] == "internal"
    assert flow["version_as_studio"]["body"]["review_media"]["download_url"]
    assert flow["version_as_client"]["body"]["review_media"]["download_url"] is None
    assert flow["version_as_client_everyone"]["body"]["review_media"]["download_url"]
    assert flow["version_as_studio_nobody"]["body"]["review_media"]["download_url"] is None
    assert flow["download_movie"]["headers"]["Content-Disposition"] == (
        'attachment; filename="RDL_SH0010_COMP_V003.mp4"'
    )
    assert flow["download_still"]["headers"]["Content-Type"] == "image/jpeg"
    assert flow["audit_of_download"]["body"]["count"] == 1

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_review_download_flow.json").write_text(
        json.dumps(flow, indent=1, sort_keys=True) + "\n"
    )
