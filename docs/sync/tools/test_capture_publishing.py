"""
Phase 9 sample capture: publishing (export jobs, the published-file registry, storage roots, destinations) (docs/sync).

Real JWT flow for an MFA superuser and the seeded roles that matter: a production-admin (does everything but the
two override codes), a vfx-supervisor (creates and updates, cannot delete), a lead-artist and an artist (read
only, as the matrix has it) and a stranger (member of nothing). Published versions are made with the production
test factory (a version is published through the review chain in Phase 7; here only the state matters). Every
call is recorded whatever its status, so failures are data. Pytest test database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_publishing.py
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
SHA = "a" * 64
SHA2 = "b" * 64


def _user(U, email, password, role_code=None):
    from apps.identity.models import Role, UserRole

    user = U.create_user(email=email, password=password)
    user.is_active = True
    user.save()
    if role_code:
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
    return user


@pytest.mark.django_db
def test_capture_publishing(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.tests.mfa_helpers import enable_mfa
    from apps.production.models import Project
    from apps.production.tests.factories import VersionFactory

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase9!9")
    enable_mfa(admin)
    sup = _user(U, "sup@example.test", "Sup-Pass-Phase9!9", "vfx-supervisor")
    padmin = _user(U, "padmin@example.test", "Padmin-Pass-Phase9!9", "production-admin")
    lead = _user(U, "lead@example.test", "Lead-Pass-Phase9!9", "lead-artist")
    artist = _user(U, "artist@example.test", "Artist-Pass-Phase9!9", "artist")
    _user(U, "stranger@example.test", "Stranger-Pass-Phase9!9", "artist")

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase9!9", admin)
    sv, _ = sign_in_plain("sup@example.test", "Sup-Pass-Phase9!9")
    pa, _ = sign_in_plain("padmin@example.test", "Padmin-Pass-Phase9!9")
    ld, _ = sign_in_plain("lead@example.test", "Lead-Pass-Phase9!9")
    ar, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase9!9")
    sg, _ = sign_in_plain("stranger@example.test", "Stranger-Pass-Phase9!9")

    # ------------------------------------------------------------ setup
    pid = call(a, "setup_project", "POST", "/api/v1/projects/", {"code": "PUB", "name": "Publishing", "workflow_type": "standard"}).json()["id"]
    pid2 = call(a, "setup_project_two", "POST", "/api/v1/projects/", {"code": "OTH", "name": "Other", "workflow_type": "standard"}).json()["id"]
    for who, role in ((sup, "Supervisor"), (padmin, "Producer"), (lead, "Lead"), (artist, "Artist")):
        call(a, f"setup_member_{who.email.split('@')[0]}", "POST", f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": role})
    project = Project.objects.get(pk=pid)
    qid = call(a, "setup_sequence", "POST", "/api/v1/sequences/", {"project": pid, "code": "SQ010", "name": "Opening"}).json()["id"]
    from apps.production.models import Shot

    shots = [Shot.objects.get(pk=call(a, f"setup_shot_{n}", "POST", "/api/v1/shots/", {"project": pid, "sequence_id": qid, "code": f"SH{n:04d}", "name": f"Shot {n}"}).json()["id"]) for n in (10, 20, 30, 40)]
    other = Project.objects.get(pk=pid2)
    counter = iter(range(1, 1000))

    def version(proj, published=True, shot=None):
        n = next(counter)
        return VersionFactory.create(project=proj, code=f"PV{n:04d}", status="Approved" if published else "Not Started", is_published=published, shot=shot)

    v1, v2, v3, v4 = (version(project, shot=s_) for s_ in shots)
    v_unpub = version(project, published=False)
    v_other = version(other)

    # ------------------------------------------------------------ storage roots
    call(pa, "roots_empty_list", "GET", "/api/v1/publishing/storage-roots/")
    call(a, "roots_create_empty", "POST", "/api/v1/publishing/storage-roots/", {})
    call(a, "roots_create_bad_code", "POST", "/api/v1/publishing/storage-roots/", {"code": "1 bad code", "name": "Bad"})
    call(sv, "roots_create_supervisor", "POST", "/api/v1/publishing/storage-roots/", {"code": "SUPROOT", "name": "Sup root"})
    call(ar, "roots_create_artist", "POST", "/api/v1/publishing/storage-roots/", {"code": "ARTROOT", "name": "Art root"})
    call(pa, "roots_create_producer", "POST", "/api/v1/publishing/storage-roots/", {"code": "PRODROOT", "name": "Producer root"})
    root1 = call(a, "roots_create", "POST", "/api/v1/publishing/storage-roots/", {"code": "PROJECTS", "name": "Projects", "linux_path": "/mnt/projects", "windows_path": "P:\\", "mac_path": "/Volumes/projects"}).json().get("id")
    call(a, "roots_create_duplicate", "POST", "/api/v1/publishing/storage-roots/", {"code": "projects", "name": "Again"})
    root2 = call(a, "roots_create_second", "POST", "/api/v1/publishing/storage-roots/", {"code": "ARCHIVE", "name": "Archive"}).json().get("id")
    call(pa, "roots_list", "GET", "/api/v1/publishing/storage-roots/")
    call(pa, "roots_detail", "GET", f"/api/v1/publishing/storage-roots/{root2}/")
    call(ar, "roots_artist_list", "GET", "/api/v1/publishing/storage-roots/")
    call(a, "roots_patch_name", "PATCH", f"/api/v1/publishing/storage-roots/{root2}/", {"name": "Cold archive"})
    call(a, "roots_patch_code", "PATCH", f"/api/v1/publishing/storage-roots/{root2}/", {"code": "OTHERCODE"})
    call(sv, "roots_patch_supervisor", "PATCH", f"/api/v1/publishing/storage-roots/{root2}/", {"name": "x"})

    # ------------------------------------------------------------ destinations
    call(pa, "destinations_create_empty", "POST", "/api/v1/publishing/destinations/", {})
    d1 = call(pa, "destinations_create", "POST", "/api/v1/publishing/destinations/", {"name": "Main cluster", "type": "Storage Cluster", "path": "/mnt/publish", "protocol": "NFS", "is_default": True}).json().get("id")
    call(pa, "destinations_create_bad_type", "POST", "/api/v1/publishing/destinations/", {"name": "Odd", "type": "S3", "path": "/x", "protocol": "NFS"})
    call(pa, "destinations_create_duplicate", "POST", "/api/v1/publishing/destinations/", {"name": "MAIN cluster", "type": "Storage Cluster", "path": "/y", "protocol": "NFS"})
    d2 = call(pa, "destinations_create_second_default", "POST", "/api/v1/publishing/destinations/", {"name": "Cloud", "type": "Cloud S3 Bucket", "path": "s3://pub", "protocol": "S3", "is_default": True}).json().get("id")
    call(pa, "destinations_list", "GET", "/api/v1/publishing/destinations/")
    call(pa, "destinations_detail", "GET", f"/api/v1/publishing/destinations/{d1}/")
    call(pa, "destinations_patch", "PATCH", f"/api/v1/publishing/destinations/{d1}/", {"path": "/mnt/publish2"})
    call(sv, "destinations_supervisor_create", "POST", "/api/v1/publishing/destinations/", {"name": "Sup dest", "type": "Storage Cluster", "path": "/s", "protocol": "NFS"})
    call(ar, "destinations_artist_list", "GET", "/api/v1/publishing/destinations/")
    call(ar, "destinations_artist_create", "POST", "/api/v1/publishing/destinations/", {"name": "Art dest", "type": "Storage Cluster", "path": "/a", "protocol": "NFS"})
    call(sv, "destinations_supervisor_delete", "DELETE", f"/api/v1/publishing/destinations/{d2}/")

    # ------------------------------------------------------------ registering files
    base = {"version_id": str(v1.pk), "storage_root": "PROJECTS", "relative_path": "show/seq/SH010/comp/v001/plate.exr", "size_bytes": 1024, "sha256": SHA}
    reg = "/api/v1/publishing/files/"
    call(pa, "files_register_empty", "POST", reg, {})
    call(pa, "files_register_unknown_version", "POST", reg, {**base, "version_id": "00000000-0000-0000-0000-000000000000"})
    call(pa, "files_register_unpublished_version", "POST", reg, {**base, "version_id": str(v_unpub.pk)})
    call(pa, "files_register_other_project_version", "POST", reg, {**base, "version_id": str(v_other.pk)})
    call(pa, "files_register_unknown_root", "POST", reg, {**base, "storage_root": "NOPE"})
    for name, path in (("parent", "../x/plate.exr"), ("backslash", "show\\plate.exr"), ("drive", "C:/x/plate.exr"), ("absolute", "/abs/plate.exr"), ("double", "a//b.exr"), ("dot", "a/./b.exr"), ("trailing", "a/b/"), ("tilde", "~/a.exr"), ("nul", "a\u0000b.exr")):
        call(pa, f"files_register_path_{name}", "POST", reg, {**base, "relative_path": path})
    call(pa, "files_register_bad_sha", "POST", reg, {**base, "sha256": "xyz"})
    call(pa, "files_register_upper_sha", "POST", reg, {**base, "relative_path": "show/upper.exr", "sha256": "A" * 64})
    call(pa, "files_register_negative_size", "POST", reg, {**base, "size_bytes": -1})
    call(pa, "files_register_unknown_field", "POST", reg, {**base, "status": "Revoked"})
    call(pa, "files_register_bad_role", "POST", reg, {**base, "role": "weird"})
    call(pa, "files_register_unknown_file_type", "POST", reg, {**base, "relative_path": "show/ft.exr", "file_type": "NOPE"})
    call(ar, "files_register_artist", "POST", reg, base)
    call(sv, "files_register_supervisor", "POST", reg, {**base, "relative_path": "show/seq/SH010/comp/v001/sup.exr"})
    f1 = call(pa, "files_register", "POST", reg, base).json().get("id")
    call(pa, "files_register_again", "POST", reg, base)
    call(pa, "files_register_conflict", "POST", reg, {**base, "sha256": SHA2})
    call(pa, "files_register_conflict_version", "POST", reg, {**base, "version_id": str(v2.pk)})
    call(pa, "files_register_proxy", "POST", reg, {**base, "relative_path": "show/seq/SH010/comp/v001/proxy.mov", "role": "proxy", "size_bytes": 99, "sha256": SHA2})
    call(pa, "files_register_sequence", "POST", reg, {**base, "relative_path": "show/seq/SH010/comp/v001/plate.%04d.exr", "frame_start": 1001, "frame_end": 1096, "sha256": "c" * 64})
    call(pa, "files_register_frames_without_pattern", "POST", reg, {**base, "relative_path": "show/seq/SH010/comp/v001/single.exr", "frame_start": 1, "frame_end": 2, "sha256": "d" * 64})
    call(pa, "files_register_frame_start_only", "POST", reg, {**base, "relative_path": "show/seq/SH010/comp/v001/part.%04d.exr", "frame_start": 1, "sha256": "e" * 64})
    call(pa, "files_register_frames_reversed", "POST", reg, {**base, "relative_path": "show/seq/SH010/comp/v001/rev.%04d.exr", "frame_start": 10, "frame_end": 1, "sha256": "f" * 64})
    f2 = call(pa, "files_register_second_version", "POST", reg, {**base, "version_id": str(v2.pk), "relative_path": "show/seq/SH020/comp/v001/plate.exr", "sha256": "1" * 64}).json().get("id")
    f4 = call(pa, "files_register_fourth", "POST", reg, {**base, "version_id": str(v4.pk), "relative_path": "show/seq/SH040/comp/v001/extra.exr", "sha256": "5" * 64}).json().get("id")
    f3 = call(pa, "files_register_third", "POST", reg, {**base, "version_id": str(v3.pk), "relative_path": "show/seq/SH030/comp/v001/plate.exr", "sha256": "2" * 64}).json().get("id")

    # the registry is append-only through the API
    call(pa, "files_put", "PUT", f"{reg}{f1}/", base)
    call(pa, "files_patch", "PATCH", f"{reg}{f1}/", {"size_bytes": 1})
    call(pa, "files_delete", "DELETE", f"{reg}{f1}/")

    # a root that holds files cannot be deleted; an empty one can
    call(a, "roots_delete_with_files", "DELETE", f"/api/v1/publishing/storage-roots/{root1}/")
    call(a, "roots_deactivate_second", "PATCH", f"/api/v1/publishing/storage-roots/{root2}/", {"is_active": False})
    call(pa, "files_register_inactive_root", "POST", reg, {**base, "storage_root": "ARCHIVE", "relative_path": "x/a.exr"})
    call(a, "roots_delete_empty", "DELETE", f"/api/v1/publishing/storage-roots/{root2}/")

    # bulk
    bulk = f"{reg}bulk-register/"
    call(pa, "files_bulk_empty", "POST", bulk, {})
    call(pa, "files_bulk_empty_list", "POST", bulk, {"items": []})
    call(pa, "files_bulk_partial", "POST", bulk, {"items": [{**base, "version_id": str(v4.pk), "relative_path": "show/seq/SH040/comp/v001/plate.exr", "sha256": "3" * 64}, {**base, "relative_path": "../bad.exr"}, base]})
    call(pa, "files_bulk_all", "POST", bulk, {"items": [{**base, "version_id": str(v4.pk), "relative_path": "show/seq/SH040/comp/v001/proxy.mov", "role": "proxy", "sha256": "4" * 64}]})
    call(ar, "files_bulk_artist", "POST", bulk, {"items": [base]})

    # ------------------------------------------------------------ the file lifecycle
    dep = lambda fid: f"{reg}{fid}/deprecate/"  # noqa: E731
    call(ar, "files_deprecate_artist", "POST", dep(f2), {"note": "x"})
    call(pa, "files_deprecate", "POST", dep(f2), {"note": "Superseded by v002"})
    call(pa, "files_deprecate_again", "POST", dep(f2), {})
    call(pa, "files_detail_deprecated", "GET", f"{reg}{f2}/")
    call(pa, "files_restore", "POST", f"{reg}{f2}/restore/", {})
    call(pa, "files_restore_again", "POST", f"{reg}{f2}/restore/", {})
    call(pa, "files_revoke_empty", "POST", f"{reg}{f3}/revoke/", {})
    call(ld, "files_revoke_lead", "POST", f"{reg}{f3}/revoke/", {"reason": "bad"})
    call(ar, "files_revoke_artist", "POST", f"{reg}{f3}/revoke/", {"reason": "bad"})
    call(sv, "files_revoke_supervisor", "POST", f"{reg}{f4}/revoke/", {"reason": "Wrong frame range"})
    call(pa, "files_revoke", "POST", f"{reg}{f3}/revoke/", {"reason": "Wrong plate"})
    call(pa, "files_restore_revoked", "POST", f"{reg}{f3}/restore/", {})
    call(pa, "files_deprecate_revoked", "POST", dep(f3), {})
    call(pa, "files_revoke_again", "POST", f"{reg}{f3}/revoke/", {"reason": "again"})
    call(pa, "files_override_without_code", "POST", f"{reg}{f3}/restore/", {"override_reason": "I am sure"})
    call(ar, "files_detail_revoked_artist", "GET", f"{reg}{f3}/")
    call(pa, "files_detail_revoked", "GET", f"{reg}{f3}/")
    call(a, "files_restore_admin", "POST", f"{reg}{f3}/restore/", {"override_reason": "superuser"})

    # ------------------------------------------------------------ reads
    call(pa, "files_detail", "GET", f"{reg}{f1}/")
    call(sg, "files_detail_stranger", "GET", f"{reg}{f1}/")
    call(sg, "files_list_stranger", "GET", reg)
    call(ar, "files_list_artist", "GET", reg)
    call(pa, "files_list", "GET", reg)

    # ------------------------------------------------------------ export jobs
    jobs = "/api/v1/publishing/"
    call(pa, "jobs_create_empty", "POST", jobs, {"dcc_tool": "Nuke", })
    call(pa, "jobs_create_no_project", "POST", jobs, {"dcc_tool": "Nuke", "name": "No project"})
    call(pa, "jobs_create_unknown_project", "POST", jobs, {"dcc_tool": "Nuke", "name": "x", "project_id": "00000000-0000-0000-0000-000000000000"})
    call(pa, "jobs_create_foreign_project", "POST", jobs, {"dcc_tool": "Nuke", "name": "x", "project_id": pid2})
    call(pa, "jobs_create_unknown_version", "POST", jobs, {"dcc_tool": "Nuke", "name": "x", "project_id": pid, "version_id": "00000000-0000-0000-0000-000000000000"})
    call(pa, "jobs_create_bad_tool", "POST", jobs, {"name": "x", "project_id": pid, "dcc_tool": "Paint"})
    call(ar, "jobs_create_artist", "POST", jobs, {"dcc_tool": "Nuke", "name": "x", "project_id": pid})
    call(pa, "jobs_create_blank_code", "POST", jobs, {"dcc_tool": "Nuke", "name": "Server-numbered", "project_id": pid, "version_id": str(v3.pk)})
    jb = call(pa, "jobs_create", "POST", jobs, {"name": "Comp export", "project_id": pid, "version_id": str(v1.pk), "dcc_tool": "Nuke", "dcc_version": "15.0", "source_file": "/shots/SH010/comp.nk", "export_path": "/exports/SH010", "export_format": "EXR"})
    jid = jb.json().get("id")
    call(pa, "jobs_create_duplicate_code", "POST", jobs, {"dcc_tool": "Nuke", "name": "dup", "project_id": pid, "version_id": str(v1.pk), "code": jb.json().get("code", "").lower()})
    call(pa, "jobs_detail_pending", "GET", f"{jobs}{jid}/")
    call(ar, "jobs_detail_artist", "GET", f"{jobs}{jid}/")
    call(sg, "jobs_detail_stranger", "GET", f"{jobs}{jid}/")
    call(sg, "jobs_list_stranger", "GET", jobs)
    call(pa, "jobs_patch", "PATCH", f"{jobs}{jid}/", {"dcc_version": "15.1", "export_options": {"compression": "zip"}})
    call(pa, "jobs_patch_status", "PATCH", f"{jobs}{jid}/", {"status": "Exported"})
    call(ar, "jobs_patch_artist", "PATCH", f"{jobs}{jid}/", {"dcc_version": "x"})
    call(pa, "jobs_start_export_pending", "POST", f"{jobs}{jid}/start-export/", {})
    call(pa, "jobs_complete_pending", "POST", f"{jobs}{jid}/complete-export/", {})
    call(pa, "jobs_fail_pending", "POST", f"{jobs}{jid}/fail/", {"reason": "x"})
    call(pa, "jobs_retry_pending", "POST", f"{jobs}{jid}/retry/", {})
    call(ar, "jobs_validate_artist", "POST", f"{jobs}{jid}/validate/", {})
    call(pa, "jobs_validate", "POST", f"{jobs}{jid}/validate/", {})
    call(pa, "jobs_detail_validated", "GET", f"{jobs}{jid}/")
    call(pa, "jobs_validate_again", "POST", f"{jobs}{jid}/validate/", {})
    call(pa, "jobs_patch_validated", "PATCH", f"{jobs}{jid}/", {"dcc_version": "15.2"})
    call(pa, "jobs_start_export", "POST", f"{jobs}{jid}/start-export/", {})
    call(pa, "jobs_start_export_again", "POST", f"{jobs}{jid}/start-export/", {})
    call(pa, "jobs_unpublish_exporting", "POST", f"{jobs}{jid}/unpublish/", {"reason": "x"})
    call(pa, "jobs_complete_empty_fail", "POST", f"{jobs}{jid}/fail/", {})
    call(pa, "jobs_complete", "POST", f"{jobs}{jid}/complete-export/", {})
    call(pa, "jobs_detail_exported", "GET", f"{jobs}{jid}/")
    call(pa, "jobs_unpublish_exported", "POST", f"{jobs}{jid}/unpublish/", {"reason": "x"})
    call(pa, "jobs_retry_exported", "POST", f"{jobs}{jid}/retry/", {})
    call(pa, "jobs_republish", "POST", f"{jobs}{jid}/republish/", {"comment": "again please"})

    # a second job that fails, is retried, and is unpublished
    j2 = call(pa, "jobs2_create", "POST", jobs, {"name": "Failing export", "project_id": pid, "version_id": str(v2.pk), "dcc_tool": "Maya"}).json().get("id")
    call(pa, "jobs2_validate", "POST", f"{jobs}{j2}/validate/", {})
    call(pa, "jobs2_delete_validated", "DELETE", f"{jobs}{j2}/")  # refused since CR-23: only Pending and Cancelled
    call(pa, "jobs2_start", "POST", f"{jobs}{j2}/start-export/", {})
    call(pa, "jobs2_fail", "POST", f"{jobs}{j2}/fail/", {"reason": "Render node went away"})
    call(pa, "jobs2_detail_failed", "GET", f"{jobs}{j2}/")
    call(pa, "jobs2_patch_failed", "PATCH", f"{jobs}{j2}/", {"dcc_version": "2024"})
    call(pa, "jobs2_retry", "POST", f"{jobs}{j2}/retry/", {})
    call(pa, "jobs2_unpublish", "POST", f"{jobs}{j2}/unpublish/", {"reason": "Not needed"})
    call(pa, "jobs2_detail_unpublished", "GET", f"{jobs}{j2}/")
    j4 = call(pa, "jobs4_create", "POST", jobs, {"dcc_tool": "Houdini", "name": "Job with a file", "project_id": pid, "version_id": str(v4.pk)}).json().get("id")
    call(pa, "files_register_with_job", "POST", reg, {**base, "version_id": str(v4.pk), "relative_path": "show/seq/SH040/comp/v001/fromjob.exr", "sha256": "6" * 64, "export_job_id": j4})
    call(pa, "jobs4_delete_with_file", "DELETE", f"{jobs}{j4}/")
    call(pa, "jobs4_detail", "GET", f"{jobs}{j4}/")
    j3 = call(pa, "jobs3_create", "POST", jobs, {"dcc_tool": "Nuke", "name": "To delete", "project_id": pid, "version_id": str(v3.pk)}).json().get("id")
    call(sv, "jobs3_delete_supervisor", "DELETE", f"{jobs}{j3}/")
    call(pa, "jobs3_delete", "DELETE", f"{jobs}{j3}/")
    call(pa, "jobs3_gone", "GET", f"{jobs}{j3}/")

    # ------------------------------------------------------------ lists and filter probes (jobs filter since CR-22; unknown params are still silently ignored)
    call(pa, "jobs_list", "GET", jobs)
    call(ar, "jobs_list_artist", "GET", jobs)
    call(a, "jobs_list_admin", "GET", jobs)
    call(pa, "jobs_project_route", "GET", f"/api/organizations/projects/{pid}/publishing/")
    call(pa, "jobs_project_route_status", "GET", f"/api/organizations/projects/{pid}/publishing/?status=Exported")
    call(pa, "jobs_project_route_search", "GET", f"/api/organizations/projects/{pid}/publishing/?search=Comp")
    call(sg, "jobs_project_route_stranger", "GET", f"/api/organizations/projects/{pid}/publishing/")

    def probe(prefix, base_url, params, client):
        call(client, f"{prefix}_baseline", "GET", base_url)
        for name, value in params:
            call(client, f"{prefix}_by_{name}_{re.sub('[^A-Za-z0-9]+', '', str(value))[:10]}", "GET", f"{base_url}{'&' if '?' in base_url else '?'}{name}={value}")

    probe("fp_jobs", f"{jobs}?project_id={pid}", [("status", "Exported"), ("status", "Failed"), ("status", "Queued"), ("status", "Published"), ("status", "Unpublished"), ("status", "Banana"), ("job_status", "Exported"), ("job_status", "pending"), ("dcc_tool", "Nuke"), ("dcc_tool", "nuke"), ("version_id", "nope"), ("entity_type", "Shot"), ("search", "Comp"), ("ordering", "name"), ("nonsense", "1")], pa)
    call(pa, "fp_jobs_by_version_id_real", "GET", f"{jobs}?version_id={v1.pk}")
    call(pa, "fp_jobs_by_version_real", "GET", f"{jobs}?version={v1.pk}")
    call(a, "fp_jobs_by_project_real", "GET", f"{jobs}?project={pid}")
    call(a, "fp_jobs_by_project_other", "GET", f"{jobs}?project={pid2}")
    call(a, "fp_jobs_all", "GET", jobs)
    call(a, "fp_jobs_by_project_id_other", "GET", f"{jobs}?project_id={pid2}")
    probe("fp_files", f"{reg}?project_id={pid}", [("version_id", str(v1.pk)), ("status", "Deprecated"), ("status", "Revoked"), ("role", "proxy"), ("storage_root", "PROJECTS"), ("latest", "true"), ("search", "plate"), ("ordering", "relative_path"), ("nonsense", "1")], pa)
    call(a, "fp_files_by_project_id_other", "GET", f"{reg}?project_id={pid2}")
    probe("fp_roots", "/api/v1/publishing/storage-roots/", [("search", "Proj"), ("is_active", "true"), ("nonsense", "1")], pa)
    probe("fp_destinations", "/api/v1/publishing/destinations/", [("search", "Cloud"), ("is_default", "true"), ("type", "Storage Cluster"), ("nonsense", "1")], pa)

    (OUT / "publishing").mkdir(parents=True, exist_ok=True)
    (OUT / "publishing" / "_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
    assert FLOW["files_register"]["status"] in (201, 200), FLOW["files_register"]
