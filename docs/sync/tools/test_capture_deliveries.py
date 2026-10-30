"""
Phase 8 sample capture: deliveries and delivery destinations (docs/sync).

Real JWT flow for an MFA superuser and the seeded roles that matter: a vfx-supervisor (creates, edits,
prepares, signs off; cannot send), a production-admin (signs off, sends, reads the passcode, deletes), a
lead-artist and an artist (read only) and a stranger (member of nothing). Published versions with registered
files are built with the backend's own test helpers (Publishing is not part of this phase's UI). Every call is
recorded whatever its status, so failures are data. Pytest test database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_deliveries.py
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
def test_capture_deliveries(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.deliveries.tests.helpers import _Request, storage_root
    from apps.production.tests.factories import VersionFactory
    from apps.publishing.services.files import PublishedFileService
    from apps.identity.tests.mfa_helpers import enable_mfa
    from apps.production.models import Project
    from apps.production.tests.factories import ProjectFactory
    from apps.publishing.models import PublishedFile

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase8!9")
    enable_mfa(admin)
    sup = _user(U, "sup@example.test", "Sup-Pass-Phase8!9", "vfx-supervisor")
    padmin = _user(U, "padmin@example.test", "Padmin-Pass-Phase8!9", "production-admin")
    lead = _user(U, "lead@example.test", "Lead-Pass-Phase8!9", "lead-artist")
    artist = _user(U, "artist@example.test", "Artist-Pass-Phase8!9", "artist")
    _user(U, "stranger@example.test", "Stranger-Pass-Phase8!9", "artist")

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase8!9", admin)
    sv, _ = sign_in_plain("sup@example.test", "Sup-Pass-Phase8!9")
    pa, _ = sign_in_plain("padmin@example.test", "Padmin-Pass-Phase8!9")
    ld, _ = sign_in_plain("lead@example.test", "Lead-Pass-Phase8!9")
    ar, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase8!9")
    sg, _ = sign_in_plain("stranger@example.test", "Stranger-Pass-Phase8!9")

    # ------------------------------------------------------------ setup
    pid = call(a, "setup_project", "POST", "/api/v1/projects/", {"code": "DLV", "name": "Delivery", "workflow_type": "standard"}).json()["id"]
    pid2 = call(a, "setup_project_two", "POST", "/api/v1/projects/", {"code": "OTH", "name": "Other", "workflow_type": "standard"}).json()["id"]
    for who, role in ((sup, "Supervisor"), (padmin, "Producer"), (lead, "Lead"), (artist, "Artist")):
        call(a, f"setup_member_{who.email.split('@')[0]}", "POST", f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": role})
    cid = call(a, "setup_client", "POST", "/api/v1/clients/", {"name": "Acme Pictures", "code": "ACME"}).json()["id"]
    project = Project.objects.get(pk=pid)

    counter = iter(range(1, 1000))

    def published_version(proj, *, files=1, published=True):
        """A version of ``proj`` with ``files`` registered files, registered by the superuser (the registry is Phase 9's UI)."""
        n = next(counter)
        version = VersionFactory.create(project=proj, code=f"DV{n:04d}", status="Approved" if published else "Not Started", is_published=published)
        root = storage_root()
        for i in range(files):
            PublishedFileService.register(
                actor=admin,
                request=_Request(admin),
                version_id=version.pk,
                data={"version_id": str(version.pk), "storage_root": root.code, "relative_path": f"show/{version.code}/plate_{i}.exr", "size_bytes": 1000 * (i + 1), "sha256": f"{i + 1:x}" * 64, "role": "main" if i == 0 else "proxy"},
            )
        return version

    other_project = Project.objects.get(pk=pid2)
    v1 = published_version(project)
    v2 = published_version(project)
    v3 = published_version(project)
    v4 = published_version(project)
    v5 = published_version(project)
    v_unpub = published_version(project, files=0, published=False)
    v_nofiles = published_version(project, files=0)
    v_other = published_version(other_project)
    ProjectFactory  # noqa: B018  (kept imported for symmetry with the helpers)

    # ------------------------------------------------------------ destinations
    call(sv, "destinations_empty_list", "GET", "/api/v1/deliveries/destinations/")
    call(pa, "destinations_create_empty", "POST", "/api/v1/deliveries/destinations/", {})
    d1 = call(pa, "destinations_create", "POST", "/api/v1/deliveries/destinations/", {"name": "Acme S3", "type": "S3", "endpoint": "s3://acme/in", "is_default": True})
    dst = d1.json().get("id")
    call(pa, "destinations_create_duplicate", "POST", "/api/v1/deliveries/destinations/", {"name": "ACME s3", "type": "S3", "endpoint": "s3://acme/other"})
    d2 = call(pa, "destinations_create_second_default", "POST", "/api/v1/deliveries/destinations/", {"name": "Acme Aspera", "type": "Aspera", "endpoint": "aspera.acme.example", "is_default": True})
    dst2 = d2.json().get("id")
    call(pa, "destinations_list", "GET", "/api/v1/deliveries/destinations/")
    call(pa, "destinations_detail", "GET", f"/api/v1/deliveries/destinations/{dst}/")
    call(pa, "destinations_patch", "PATCH", f"/api/v1/deliveries/destinations/{dst}/", {"endpoint": "s3://acme/incoming"})
    call(sv, "destinations_supervisor_create", "POST", "/api/v1/deliveries/destinations/", {"name": "Sup", "type": "S3", "endpoint": "s3://sup/in"})
    call(ar, "destinations_artist_list", "GET", "/api/v1/deliveries/destinations/")
    call(ar, "destinations_artist_create", "POST", "/api/v1/deliveries/destinations/", {"name": "Art", "type": "S3", "endpoint": "s3://art/in"})
    call(sv, "destinations_supervisor_delete", "DELETE", f"/api/v1/deliveries/destinations/{dst2}/")

    # ------------------------------------------------------------ create
    call(sv, "create_empty", "POST", "/api/v1/deliveries/", {})
    call(sv, "create_no_project", "POST", "/api/v1/deliveries/", {"name": "No project"})
    call(sv, "create_unknown_project", "POST", "/api/v1/deliveries/", {"name": "x", "project_id": "00000000-0000-0000-0000-000000000000"})
    call(sv, "create_unknown_client", "POST", "/api/v1/deliveries/", {"name": "x", "project_id": pid, "client_id": "00000000-0000-0000-0000-000000000000"})
    call(sv, "create_foreign_project", "POST", "/api/v1/deliveries/", {"name": "x", "project_id": pid2})
    call(ld, "create_lead", "POST", "/api/v1/deliveries/", {"name": "x", "project_id": pid})
    call(sv, "create_blank_code", "POST", "/api/v1/deliveries/", {"name": "Server-numbered", "project_id": pid})
    call(sv, "create_destination_text_mismatch", "POST", "/api/v1/deliveries/", {"name": "x", "project_id": pid, "destination_id": dst, "delivery_destination": "somewhere else"})
    dv = call(sv, "create", "POST", "/api/v1/deliveries/", {"name": "Reel 1 turnover", "project_id": pid, "client_id": cid, "destination_id": dst, "delivery_method": "S3", "passcode": "s3cret-pass", "notes": "internal", "client_notes": "please confirm", "expires_at": "2026-12-01T00:00:00Z"})
    did = dv.json().get("id")
    call(sv, "create_duplicate_code", "POST", "/api/v1/deliveries/", {"name": "dup", "project_id": pid, "code": dv.json().get("code", "").lower()})

    # ------------------------------------------------------------ reads
    call(sv, "detail_draft", "GET", f"/api/v1/deliveries/{did}/")
    call(ar, "detail_artist", "GET", f"/api/v1/deliveries/{did}/")
    call(sg, "detail_stranger", "GET", f"/api/v1/deliveries/{did}/")
    call(sg, "list_stranger", "GET", "/api/v1/deliveries/")
    call(ld, "patch_lead", "PATCH", f"/api/v1/deliveries/{did}/", {"notes": "lead"})
    call(sv, "patch_status", "PATCH", f"/api/v1/deliveries/{did}/", {"status": "Approved"})
    call(sv, "patch_notes", "PATCH", f"/api/v1/deliveries/{did}/", {"notes": "internal v2", "name": "Reel 1 turnover (final)"})
    call(sv, "put_full", "PUT", f"/api/v1/deliveries/{did}/", {"name": "Reel 1 turnover (final)", "delivery_method": "S3"})

    # ------------------------------------------------------------ items
    call(sv, "add_empty", "POST", f"/api/v1/deliveries/{did}/add-version/", {})
    call(sv, "add_unknown", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": "00000000-0000-0000-0000-000000000000"})
    call(sv, "add_unpublished", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": str(v_unpub.pk)})
    call(sv, "add_no_files", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": str(v_nofiles.pk)})
    call(sv, "add_other_project", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": str(v_other.pk)})
    call(ld, "add_lead", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": str(v1.pk)})
    call(sv, "add_first", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": str(v1.pk), "file_path": "ignored", "checksum_sha256": "ignored"})
    call(sv, "add_again", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": str(v1.pk)})
    added = call(sv, "add_second", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": str(v2.pk)}).json()
    items = added.get("versions") or added.get("items") or []
    uid = (items[-1] or {}).get("uid") if items else None
    call(sv, "remove_empty", "POST", f"/api/v1/deliveries/{did}/remove-version/", {})
    call(sv, "remove_unknown", "POST", f"/api/v1/deliveries/{did}/remove-version/", {"item_id": "00000000-0000-0000-0000-000000000000"})
    call(sv, "remove_second", "POST", f"/api/v1/deliveries/{did}/remove-version/", {"item_id": uid})
    again = call(sv, "add_second_again", "POST", f"/api/v1/deliveries/{did}/add-version/", {"version_id": str(v2.pk)}).json()
    uid = ((again.get("versions") or [])[-1] or {}).get("uid")

    # ------------------------------------------------------------ the working states and QC
    call(sv, "sign_off_draft", "POST", f"/api/v1/deliveries/{did}/sign-off/", {})
    call(sv, "submit_draft", "POST", f"/api/v1/deliveries/{did}/submit/", {})
    call(sv, "validate", "POST", f"/api/v1/deliveries/{did}/validate/", {})
    call(sv, "retry", "POST", f"/api/v1/deliveries/{did}/retry/", {})
    call(sv, "qc_after_validate", "GET", f"/api/v1/deliveries/{did}/qc/")
    PublishedFile.objects.filter(version_id=v2.pk).update(checksum_state="mismatch")
    call(sv, "prepare_qc_failed", "POST", f"/api/v1/deliveries/{did}/prepare/", {})
    call(sv, "qc_failed", "GET", f"/api/v1/deliveries/{did}/qc/")
    PublishedFile.objects.filter(version_id=v2.pk).update(checksum_state="verified")
    call(ar, "prepare_artist", "POST", f"/api/v1/deliveries/{did}/prepare/", {})
    call(sv, "prepare", "POST", f"/api/v1/deliveries/{did}/prepare/", {})
    call(sv, "detail_prepared", "GET", f"/api/v1/deliveries/{did}/")
    call(sv, "qc_passed", "GET", f"/api/v1/deliveries/{did}/qc/")
    call(sv, "history_prepared", "GET", f"/api/v1/deliveries/{did}/history/")
    call(sv, "remove_after_prepare", "POST", f"/api/v1/deliveries/{did}/remove-version/", {"item_id": uid})

    # ------------------------------------------------------------ sign-off, separation of duties, send
    call(pa, "submit_before_sign_off", "POST", f"/api/v1/deliveries/{did}/submit/", {})
    call(sv, "sign_off_preparer", "POST", f"/api/v1/deliveries/{did}/sign-off/", {})
    call(ld, "sign_off_lead", "POST", f"/api/v1/deliveries/{did}/sign-off/", {})
    call(sv, "sign_off_override_without_code", "POST", f"/api/v1/deliveries/{did}/sign-off/", {"override_reason": "I am sure"})
    call(pa, "sign_off", "POST", f"/api/v1/deliveries/{did}/sign-off/", {"notes": "QC looks right"})
    call(pa, "sign_off_again", "POST", f"/api/v1/deliveries/{did}/sign-off/", {})
    call(sv, "patch_signed_off", "PATCH", f"/api/v1/deliveries/{did}/", {"notes": "too late"})
    call(sv, "reopen_supervisor", "POST", f"/api/v1/deliveries/{did}/reopen/", {})
    call(pa, "reopen", "POST", f"/api/v1/deliveries/{did}/reopen/", {})
    call(pa, "sign_off_second", "POST", f"/api/v1/deliveries/{did}/sign-off/", {})
    call(sv, "submit_supervisor", "POST", f"/api/v1/deliveries/{did}/submit/", {"transfer_reference": "ASPERA-1"})
    call(pa, "passcode_before_send", "GET", f"/api/v1/deliveries/{did}/passcode/")
    call(sv, "passcode_supervisor", "GET", f"/api/v1/deliveries/{did}/passcode/")
    call(ar, "passcode_artist", "GET", f"/api/v1/deliveries/{did}/passcode/")
    call(sg, "passcode_stranger", "GET", f"/api/v1/deliveries/{did}/passcode/")
    call(pa, "submit", "POST", f"/api/v1/deliveries/{did}/submit/", {"transfer_reference": "ASPERA-1"})
    call(pa, "submit_again", "POST", f"/api/v1/deliveries/{did}/submit/", {})
    call(pa, "detail_submitted", "GET", f"/api/v1/deliveries/{did}/")
    call(pa, "cancel_submitted", "POST", f"/api/v1/deliveries/{did}/cancel/", {"reason": "too late"})
    call(sv, "complete_submitted", "POST", f"/api/v1/deliveries/{did}/complete/", {})
    call(sv, "approve_supervisor", "POST", f"/api/v1/deliveries/{did}/approve/", {})
    call(pa, "approve_both_spellings", "POST", f"/api/v1/deliveries/{did}/approve/", {"client_notes": "a", "notes": "b"})
    call(pa, "approve", "POST", f"/api/v1/deliveries/{did}/approve/", {"notes": "Client accepted by email"})
    call(pa, "reject_approved", "POST", f"/api/v1/deliveries/{did}/reject/", {"reason": "x"})
    call(sv, "complete", "POST", f"/api/v1/deliveries/{did}/complete/", {})
    call(pa, "passcode_view", "GET", f"/api/v1/deliveries/{did}/passcode/")
    call(a, "passcode_admin", "GET", f"/api/v1/deliveries/{did}/passcode/")
    call(sv, "history_complete", "GET", f"/api/v1/deliveries/{did}/history/")
    call(ar, "history_artist", "GET", f"/api/v1/deliveries/{did}/history/")
    call(ar, "qc_artist", "GET", f"/api/v1/deliveries/{did}/qc/")
    call(sg, "history_stranger", "GET", f"/api/v1/deliveries/{did}/history/")
    call(sv, "detail_complete", "GET", f"/api/v1/deliveries/{did}/")
    call(sv, "revise_complete", "POST", f"/api/v1/deliveries/{did}/revise/", {})

    # ------------------------------------------------------------ a second delivery: the client rejects it, it is revised
    def to_submitted(name, version):
        d = call(sv, f"{name}_create", "POST", "/api/v1/deliveries/", {"name": name, "project_id": pid, "client_id": cid}).json()["id"]
        call(sv, f"{name}_add", "POST", f"/api/v1/deliveries/{d}/add-version/", {"version_id": str(version.pk)})
        call(sv, f"{name}_prepare", "POST", f"/api/v1/deliveries/{d}/prepare/", {})
        call(pa, f"{name}_sign_off", "POST", f"/api/v1/deliveries/{d}/sign-off/", {})
        call(pa, f"{name}_submit", "POST", f"/api/v1/deliveries/{d}/submit/", {})
        return d

    rej = to_submitted("rejected", v3)
    call(pa, "reject_empty", "POST", f"/api/v1/deliveries/{rej}/reject/", {})
    call(pa, "reject", "POST", f"/api/v1/deliveries/{rej}/reject/", {"reason": "Colour is off in reel 2"})
    call(sv, "revise_supervisor", "POST", f"/api/v1/deliveries/{rej}/revise/", {})
    call(pa, "revise", "POST", f"/api/v1/deliveries/{rej}/revise/", {})
    call(pa, "revise_again", "POST", f"/api/v1/deliveries/{rej}/revise/", {})
    call(pa, "detail_rejected", "GET", f"/api/v1/deliveries/{rej}/")

    # ------------------------------------------------------------ cancel and bulk-cancel
    c1 = call(sv, "cancel_create", "POST", "/api/v1/deliveries/", {"name": "To cancel", "project_id": pid}).json()["id"]
    call(ld, "cancel_lead", "POST", f"/api/v1/deliveries/{c1}/cancel/", {"reason": "x"})
    call(sv, "cancel", "POST", f"/api/v1/deliveries/{c1}/cancel/", {"reason": "Client postponed"})
    call(sv, "cancel_again", "POST", f"/api/v1/deliveries/{c1}/cancel/", {})
    b1 = call(sv, "bulk_create_one", "POST", "/api/v1/deliveries/", {"name": "Bulk one", "project_id": pid}).json()["id"]
    b2 = call(sv, "bulk_create_two", "POST", "/api/v1/deliveries/", {"name": "Bulk two", "project_id": pid}).json()["id"]
    call(sv, "bulk_cancel_empty", "POST", "/api/v1/deliveries/bulk-cancel/", {})
    call(ld, "bulk_cancel_lead", "POST", "/api/v1/deliveries/bulk-cancel/", {"ids": [b1]})
    call(sv, "bulk_cancel_partial", "POST", "/api/v1/deliveries/bulk-cancel/", {"ids": [b1, did, "00000000-0000-0000-0000-000000000000"], "reason": "Postponed"})
    call(sv, "bulk_cancel_all", "POST", "/api/v1/deliveries/bulk-cancel/", {"ids": [b2], "reason": "Postponed"})
    sent = to_submitted("sent", v4)

    # an item is protected by the QC rows of a run, so it cannot be removed once the delivery was validated
    qr = call(sv, "qcremove_create", "POST", "/api/v1/deliveries/", {"name": "qcremove", "project_id": pid}).json()["id"]
    qadd = call(sv, "qcremove_add", "POST", f"/api/v1/deliveries/{qr}/add-version/", {"version_id": str(v5.pk)}).json()
    quid = qadd["versions"][0]["uid"]
    call(sv, "qcremove_validate", "POST", f"/api/v1/deliveries/{qr}/validate/", {})
    call(sv, "qcremove_remove", "POST", f"/api/v1/deliveries/{qr}/remove-version/", {"item_id": quid})
    call(sv, "qcremove_detail", "GET", f"/api/v1/deliveries/{qr}/")
    call(a, "other_project_create", "POST", "/api/v1/deliveries/", {"name": "Other project turnover", "project_id": pid2})

    # ------------------------------------------------------------ lists and filter probes (unknown params are silently ignored)
    call(sv, "list", "GET", "/api/v1/deliveries/")
    call(ar, "list_artist", "GET", "/api/v1/deliveries/")
    call(a, "list_admin", "GET", "/api/v1/deliveries/")

    def probe(prefix, base, params, client):
        call(client, f"{prefix}_baseline", "GET", base)
        for name, value in params:
            call(client, f"{prefix}_by_{name}_{re.sub('[^A-Za-z0-9]+', '', str(value))[:10]}", "GET", f"{base}{'&' if '?' in base else '?'}{name}={value}")

    probe(
        "fp_deliveries",
        f"/api/v1/deliveries/?project_id={pid}",
        [("status", "Completed"), ("status", "Cancelled"), ("client_status", "Approved"), ("client_id", cid), ("client", cid), ("delivery_method", "Aspera"), ("destination_id", dst), ("search", "Reel"), ("search", "DLV-DLV-0002"), ("ordering", "name"), ("ordering", "-name"), ("is_archived", "true"), ("nonsense", "1")],
        pa,
    )
    call(a, "fp_deliveries_all_projects", "GET", "/api/v1/deliveries/")
    call(a, "fp_deliveries_by_project_id_other", "GET", f"/api/v1/deliveries/?project_id={pid2}")
    call(a, "fp_deliveries_by_project_other", "GET", f"/api/v1/deliveries/?project={pid2}")
    probe("fp_destinations", "/api/v1/deliveries/destinations/", [("search", "Aspera"), ("is_default", "true"), ("type", "S3"), ("ordering", "name"), ("nonsense", "1")], pa)

    # ------------------------------------------------------------ the project route the old tab used
    call(pa, "project_route", "GET", f"/api/organizations/projects/{pid}/deliveries")
    call(pa, "project_route_slash", "GET", f"/api/organizations/projects/{pid}/deliveries/")
    call(pa, "project_route_other", "GET", f"/api/organizations/projects/{pid2}/deliveries/")
    call(sg, "project_route_stranger", "GET", f"/api/organizations/projects/{pid}/deliveries/")
    call(pa, "project_route_search", "GET", f"/api/organizations/projects/{pid}/deliveries/?search=Reel&page_size=1")

    # ------------------------------------------------------------ deleting (after the probes, which need these rows)
    call(sv, "delete_supervisor", "DELETE", f"/api/v1/deliveries/{c1}/")
    call(pa, "delete_cancelled", "DELETE", f"/api/v1/deliveries/{c1}/")
    call(pa, "delete_gone", "GET", f"/api/v1/deliveries/{c1}/")
    call(pa, "delete_submitted", "DELETE", f"/api/v1/deliveries/{sent}/")
    call(pa, "delete_complete", "DELETE", f"/api/v1/deliveries/{did}/")
    call(pa, "delete_complete_gone", "GET", f"/api/v1/deliveries/{did}/")

    (OUT / "deliveries").mkdir(parents=True, exist_ok=True)
    (OUT / "deliveries" / "_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
    assert FLOW["create"]["status"] == 201, FLOW["create"]
