"""
SEC-PUB-03 and SEC-PUB-04: nothing sensitive reaches the logs, and no response carries a URL,
a token or a signed link (Q3: StudioHub registers paths, it never serves files).
"""

from __future__ import annotations

import logging

import pytest

from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.services.jobs import create_job
from apps.publishing.tasks.verify import verify_file
from apps.publishing.tests.helpers import (
    SHA,
    client_for,
    member,
    published_version,
    registration,
)

pytestmark = pytest.mark.django_db

FILES = "/api/v1/publishing/files/"
JOBS = "/api/v1/publishing/"

# Distinctive values: if one of these shows up in a log line, something logged a secret.
PATH = "secret-show/sh010/PATH_MARKER_41.exr"
BAD_PATH = "../etc/BADPATH_MARKER_42"
REASON = "REVOKE_REASON_MARKER_43"
FAIL_REASON = "FAIL_REASON_MARKER_44"
JOB_NAME = "JOB_NAME_MARKER_45"
CHECKSUM = "5ec0de" * 10 + "abcd"  # 64 hex characters, never legitimately logged
WRONG_CHECKSUM = "CHECKSUM_MARKER_46"
OVERRIDE_REASON = "OVERRIDE_REASON_MARKER_47"
MARKERS = (PATH, BAD_PATH, REASON, FAIL_REASON, JOB_NAME, CHECKSUM, WRONG_CHECKSUM, OVERRIDE_REASON)


@pytest.fixture
def world(project, root):
    owner = member(
        project, P.VIEW, P.CREATE, P.UPDATE, P.DELETE, P.DEPRECATE, P.REVOKE, P.STATUS_OVERRIDE
    )
    return owner, client_for(owner), published_version(project), root, project


def _everything_logged(caplog, capfd) -> str:
    captured = capfd.readouterr()
    return "\n".join([caplog.text, captured.out, captured.err])


def test_no_marker_reaches_a_log_line(world, caplog, capfd, settings, tmp_path):
    owner, api, version, root, project = world
    caplog.set_level(logging.DEBUG)
    settings.PUBLISHING_STORAGE_MOUNTS = {"PROJECTS": str(tmp_path)}
    (tmp_path / "secret-show" / "sh010").mkdir(parents=True)
    (tmp_path / PATH).write_bytes(b"different bytes: a mismatch")

    # registration, good and bad
    created = api.post(
        FILES,
        registration(version, root, PATH, sha256=CHECKSUM, size_bytes=26),
        format="json",
    )
    assert created.status_code == 201
    file_id = created.json()["id"]
    api.post(FILES, registration(version, root, BAD_PATH), format="json")
    api.post(FILES, registration(version, root, "ok/a.exr", sha256=WRONG_CHECKSUM), format="json")
    api.post(
        f"{FILES}bulk-register/",
        {"items": [registration(version, root, BAD_PATH), registration(version, root, "ok/b.exr")]},
        format="json",
    )
    # a conflicting registration
    api.post(FILES, registration(version, root, PATH, sha256=SHA), format="json")
    # verification finds a mismatch
    verify_file(file_id)
    # lifecycle with reasons
    api.post(f"{FILES}{file_id}/revoke/", {"reason": REASON}, format="json")
    api.post(f"{FILES}{file_id}/restore/", {"override_reason": OVERRIDE_REASON}, format="json")
    # jobs
    job = create_job(
        actor=None, data={
            "name": JOB_NAME, "entity_type": "Shot", "entity_id": "x", "entity_code": "S",
            "entity_name": "S", "dcc_tool": "Maya", "source_file": "a", "project_id": str(project.pk),
        },
    )  # fmt: skip
    api.patch(f"{JOBS}{job.pk}/", {"name": JOB_NAME + "_EDIT"}, format="json")
    api.post(f"{JOBS}{job.pk}/validate/", {}, format="json")
    api.post(f"{JOBS}{job.pk}/start-export/", {}, format="json")
    api.post(f"{JOBS}{job.pk}/fail/", {"reason": FAIL_REASON}, format="json")
    api.post(f"{JOBS}{job.pk}/unpublish/", {"reason": REASON}, format="json")

    logged = _everything_logged(caplog, capfd)

    assert "request_completed" in logged, "the test captured no log lines at all"
    for marker in MARKERS:
        assert marker not in logged, f"{marker} reached the logs"


def test_the_checks_above_would_notice_a_leak(caplog, capfd):
    """Guards the guard: a marker that is logged really is found in what we capture."""
    caplog.set_level(logging.INFO)
    logging.getLogger("api").info("leaky %s", PATH)

    assert PATH in _everything_logged(caplog, capfd)


class TestResponsesCarryNoLinks:
    FILE_KEYS = {
        "id", "version_id", "project_id", "storage_root", "relative_path", "role", "file_type",
        "size_bytes", "sha256", "frame_start", "frame_end", "checksum_state",
        "checksum_checked_at", "status", "status_changed_at", "revoke_reason", "export_job_id",
        "created_at", "created_by_id",
    }  # fmt: skip
    FORBIDDEN = (
        "http://",
        "https://",
        "://",
        "token",
        "signature",
        "signed",
        "expires",
        "download",
    )

    def test_a_file_has_exactly_the_documented_fields(self, world):
        _, api, version, root, _ = world
        file_id = api.post(FILES, registration(version, root), format="json").json()["id"]

        detail = api.get(f"{FILES}{file_id}/").json()
        listed = api.get(FILES).json()["results"][0]

        assert set(detail) == set(listed) == self.FILE_KEYS

    def test_no_file_response_contains_a_link_or_a_token(self, world):
        _, api, version, root, _ = world
        file_id = api.post(FILES, registration(version, root), format="json").json()["id"]
        api.post(f"{FILES}{file_id}/deprecate/", {}, format="json")
        texts = [
            api.get(FILES).content.decode().lower(),
            api.get(f"{FILES}{file_id}/").content.decode().lower(),
            api.get(f"{FILES}?latest=true").content.decode().lower(),
            api.get("/api/v1/publishing/storage-roots/").content.decode().lower(),
        ]

        for text in texts:
            for word in self.FORBIDDEN:
                assert word not in text, word

    def test_the_serializer_has_no_url_or_token_field(self):
        from apps.publishing.api.serializers.file import PublishedFileSerializer

        for name in PublishedFileSerializer.Meta.fields:
            assert not any(word in name for word in ("url", "link", "token", "signed", "secret"))
