"""
Phase 0 sample capture (read-only against the pytest test DB; everything rolls back).

Seeds demo data inside the test transaction, then records real responses for every
list/detail route plus negative paths. Output: docs/sync/samples/<app>/<resource>.json
"""

from __future__ import annotations

import json
import os
import re
import uuid
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

S = Path(os.environ["SYNC_SCRATCH"])
OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
ROUTES = [l.rstrip("\n").split("\t") for l in (S / "routes.tsv").read_text().splitlines()]

SECRET_KEYS = re.compile(
    r"(^|_)(access|refresh|token|secret|key|challenge|passcode|password|provisioning_uri|qr|digest|hash|code_hash|recovery_codes?)$",
    re.I,
)
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def redact(v, key=""):
    if isinstance(v, dict):
        return {k: redact(x, k) for k, x in v.items()}
    if isinstance(v, list):
        return [redact(x, key) for x in v]
    if isinstance(v, str):
        if key and SECRET_KEYS.search(key) and key not in ("key_prefix", "token_prefix", "prefix") and len(v) > 8 and " " not in v:
            return "<redacted>"
        v = EMAIL.sub("user@example.test", v)
        return v if len(v) <= 160 else v[:160] + "…<truncated>"
    return v


def trim(body):
    """Keep shapes, not volume: first 2 rows of any list result."""
    if isinstance(body, dict) and isinstance(body.get("results"), list):
        body = {**body, "results": body["results"][:2], "_results_total_in_page": len(body["results"])}
    elif isinstance(body, list):
        body = {"_bare_list": True, "_len": len(body), "items": body[:2]}
    return body


def call(client, method, path, data=None):
    url = "/" + path
    resp = getattr(client, method.lower())(url, data=data, format="json") if data is not None else getattr(client, method.lower())(url)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Retry-After", "Deprecation", "Sunset", "Link", "Allow") if resp.get(h)}
    return {"request": {"method": method, "path": url, "body": redact(data)}, "status": resp.status_code, "headers": headers, "body": redact(trim(body))}


def first_id(sample):
    b = sample["body"]
    rows = b.get("results") if isinstance(b, dict) and "results" in b else (b.get("items") if isinstance(b, dict) else None)
    if rows:
        r = rows[0]
        if isinstance(r, dict):
            return r.get("id") or r.get("uuid") or r.get("pk")
    return None


def save(app, name, data):
    d = OUT / app
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{name}.json").write_text(json.dumps(data, indent=2, default=str, sort_keys=False) + "\n")


@pytest.mark.django_db
def test_capture(django_user_model):
    from django.db import connection
    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    out = StringIO()
    call_command("init_platform", stdout=out, stderr=out)
    (S / "seed_log.txt").write_text(out.getvalue())

    from apps.audit.tests import factories as af
    from apps.core.tests import factories as cf
    from apps.identity.models import Role, UserRole
    from apps.identity.tests import factories as idf
    from apps.masterdata.tests import factories as mf
    from apps.production.tests import factories as pf
    from apps.settings.tests import factories as sf

    User = django_user_model
    admin = User.objects.create_superuser(email="admin@example.test", password="Phase0-Admin-Pass!9")
    norole = User.objects.create_user(email="norole@example.test", password="Phase0-Sample-Pass!9")
    norole.is_active = True
    norole.save()
    artist = User.objects.create_user(email="artist@example.test", password="Phase0-Artist-Pass!9")
    UserRole.objects.create(user=artist, role=Role.objects.get(code="artist"))
    idf.ProfileFactory(user=artist) if not hasattr(artist, "profile") else None

    p = pf.ProjectFactory()
    ep = pf.EpisodeFactory(project=p)
    for i in range(2):
        seq = pf.SequenceFactory(project=p)
        pf.ShotFactory(project=p, sequence=seq)
        pf.AssetFactory(project=p)
        pf.TaskFactory(project=p)
        pf.ShowFactory(project=p)
        pf.VersionFactory(project=p)
        pf.MediaFactory(project=p)
        pf.PlaylistFactory(project=p)
        pf.ReviewFactory(project=p)
        pf.EditorialTrackFactory(project=p)
        pf.WorkflowFactory(project=p)
        pf.TimelogFactory(project=p)
    for fac in (mf.ClientContactFactory, mf.VendorContactFactory, mf.ClientContractFactory, mf.VendorContractFactory,
                mf.PersonFactory, mf.SoftwareVersionFactory, mf.MasterTaskTypeFactory, mf.MasterAssetTypeFactory,
                mf.MasterShotTypeFactory, mf.MasterReviewTypeFactory, mf.MasterFileTypeFactory,
                cf.TagFactory, cf.AttachmentFactory,
                af.AuditLogFactory, af.ActivityFactory, af.APIRequestFactory, af.BackgroundJobFactory,
                af.ChangeLogFactory, af.ErrorLogFactory, af.TrackFactory,
                sf.ThemeFactory, sf.DefinitionFactory, sf.FeatureFlagFactory, sf.LocalizationFactory, sf.SystemSettingFactory,
                idf.LoginAttemptFactory, idf.SecurityEventFactory, idf.IPBlacklistFactory):
        for _ in range(2):
            try:
                fac()
            except Exception as e:  # record, keep going
                (S / "seed_errors.txt").open("a").write(f"{fac.__name__}: {e!r}\n")
    idf.TrustedDeviceFactory(user=admin)
    idf.UserSessionFactory(user=admin)

    anon = APIClient()
    a = APIClient(); a.force_authenticate(admin)
    n = APIClient(); n.force_authenticate(norole)
    r = APIClient()
    if artist:
        r.force_authenticate(artist)

    from apps.production.models import Project
    project_id = str(Project.objects.filter(is_deleted=False).values_list("id", flat=True).first())

    index = []
    seen = set()
    for row in ROUTES:
        path, app, view = row[0], row[1], row[2]
        actions = row[3] if len(row) > 3 else ""
        if not path.startswith("api/") or path.startswith("api/schema") or app == "rest_framework":
            continue
        if "{project_id}" in path:
            if not path.endswith("/"):
                continue
            path = path.replace("{project_id}", project_id)
        has_param = "{" in path
        is_list = '"get": "list"' in actions
        is_apiview = not actions
        if has_param or not (is_list or is_apiview):
            continue
        key = (app, view, path)
        if key in seen:
            continue
        seen.add(key)
        name = path.replace("api/v1/", "").replace("api/organizations/projects/" + project_id, "project-scoped").strip("/").replace("/", "__") or "root"
        rec = {"view": view, "app": app, "actions": actions}
        rec["list_admin"] = call(a, "GET", path)
        rec["list_anon"] = call(anon, "GET", path)
        rec["list_norole"] = call(n, "GET", path)
        if artist:
            rec["list_artist"] = call(r, "GET", path)
        if is_list:
            oid = first_id(rec["list_admin"])
            # detail route lives at path + "{id}/"
            if oid:
                rec["detail_admin"] = call(a, "GET", f"{path}{oid}/")
            rec["detail_404"] = call(a, "GET", f"{path}{uuid.uuid4()}/")
            if '"post": "create"' in actions:
                rec["create_empty_400"] = call(a, "POST", path, {})
                rec["create_norole_403"] = call(n, "POST", path, {})
        save(app, name, rec)
        index.append({"app": app, "view": view, "path": "/" + path, "file": f"{app}/{name}.json",
                      "list_status": rec["list_admin"]["status"], "anon": rec["list_anon"]["status"],
                      "norole": rec["list_norole"]["status"], "artist": rec.get("list_artist", {}).get("status")})

    # ---- auth flow through the real JWT chain ----
    authf = {}
    authf["login_ok"] = call(anon, "POST", "api/v1/auth/login/", {"email": "norole@example.test", "password": "Phase0-Sample-Pass!9"})
    authf["login_bad_password"] = call(APIClient(), "POST", "api/v1/auth/login/", {"email": "norole@example.test", "password": "wrong"})
    authf["login_missing_fields"] = call(APIClient(), "POST", "api/v1/auth/login/", {})
    from apps.identity.services.authentication import AuthenticationService  # noqa: F401  (import check only)
    resp = APIClient().post("/api/v1/auth/login/", {"email": "norole@example.test", "password": "Phase0-Sample-Pass!9"}, format="json")
    tokens = resp.json().get("tokens", {})
    jc = APIClient(); jc.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens.get('access')}")
    authf["me_jwt"] = call(jc, "GET", "api/v1/auth/me/")
    authf["me_patch_invalid"] = call(jc, "PATCH", "api/v1/auth/me/", {"avatar_url": "not-a-url"})
    authf["refresh_ok"] = call(APIClient(), "POST", "api/v1/auth/refresh/", {"refresh": tokens.get("refresh")})
    authf["refresh_reused_rotated"] = call(APIClient(), "POST", "api/v1/auth/refresh/", {"refresh": tokens.get("refresh")})
    authf["refresh_garbage"] = call(APIClient(), "POST", "api/v1/auth/refresh/", {"refresh": "garbage"})
    bad = APIClient(); bad.credentials(HTTP_AUTHORIZATION="Bearer garbage.token.value")
    authf["me_bad_token"] = call(bad, "GET", "api/v1/auth/me/")
    authf["me_admin"] = call(a, "GET", "api/v1/auth/me/")
    if artist:
        authf["me_artist"] = call(r, "GET", "api/v1/auth/me/")
    authf["logout"] = call(jc, "POST", "api/v1/auth/logout/", {"refresh": tokens.get("refresh")})
    authf["me_after_logout"] = call(jc, "GET", "api/v1/auth/me/")
    save("identity", "_auth_flow", authf)

    # ---- conflict / protect / method samples ----
    misc = {}
    proj = call(a, "GET", "api/v1/projects/")
    p0 = (proj["body"].get("results") or [{}])[0]
    misc["project_create_duplicate_code"] = call(a, "POST", "api/v1/projects/", {"name": "Dup", "code": p0.get("code")})
    misc["project_put_partial_payload"] = call(a, "PUT", f"api/v1/projects/{p0.get('id')}/", {"name": "x"})
    misc["method_not_allowed"] = call(a, "PATCH", "api/v1/audit/audit-logs/")
    from apps.masterdata.models import Department
    dep = Department.objects.filter(is_deleted=False).first()
    if dep:
        misc["department_delete_referenced"] = call(a, "DELETE", f"api/v1/departments/{dep.pk}/")
        misc["department_detail_after_delete"] = call(a, "GET", f"api/v1/departments/{dep.pk}/")
    misc["page_size_default"] = {"count_keys": list(call(a, "GET", "api/v1/tasks/")["body"].keys())}
    t = a.get("/api/v1/tasks/").json()
    misc["page_size_default"]["page_len"] = len(t.get("results", []))
    misc["page_size_default"]["count"] = t.get("count")
    t2 = a.get("/api/v1/tasks/?limit=3").json()
    misc["page_size_limit_alias"] = {"page_len": len(t2.get("results", [])), "next": redact(t2.get("next"))}
    t3 = a.get("/api/v1/tasks/?page=9999").json()
    misc["page_out_of_range"] = redact(t3)
    for _ in range(30):
        pf.TaskFactory(project=p)
    t4 = a.get("/api/v1/tasks/").json()
    misc["page_size_default_with_34_rows"] = {"page_len": len(t4.get("results", [])), "count": t4.get("count")}
    t5 = a.get("/api/v1/tasks/?page_size=1000").json()
    misc["page_size_over_max"] = {"page_len": len(t5.get("results", [])), "count": t5.get("count")}
    t6 = a.get("/api/v1/tasks/?ordering=-created_at&search=zzz-nomatch").json()
    misc["search_no_match"] = redact(t6)
    misc["unknown_ordering_field"] = call(a, "GET", "api/v1/tasks/?ordering=not_a_field")
    misc["invalid_filter_value"] = call(a, "GET", "api/v1/tasks/?project=not-a-uuid")
    save("_misc", "conflicts_and_pagination", misc)

    # clean login -> logout -> reuse
    lo = {}
    resp = APIClient().post("/api/v1/auth/login/", {"email": "norole@example.test", "password": "Phase0-Sample-Pass!9"}, format="json")
    tk = resp.json()["tokens"]
    c2 = APIClient(); c2.credentials(HTTP_AUTHORIZATION=f"Bearer {tk['access']}")
    lo["logout_ok"] = call(c2, "POST", "api/v1/auth/logout/", {"refresh": tk["refresh"]})
    lo["me_after_logout"] = call(c2, "GET", "api/v1/auth/me/")
    lo["refresh_after_logout"] = call(APIClient(), "POST", "api/v1/auth/refresh/", {"refresh": tk["refresh"]})
    lo["change_password_wrong_old"] = call(jc, "POST", "api/v1/auth/change-password/", {"old_password": "x", "new_password": "Another-Pass-123!"})
    lo["forgot_password_unknown_email"] = call(APIClient(), "POST", "api/v1/auth/forgot-password/", {"email": "nobody@example.test"})
    save("identity", "_auth_logout_flow", lo)

    (OUT / "INDEX.json").write_text(json.dumps(index, indent=1) + "\n")
