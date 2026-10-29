"""
Phase 2 sample capture: identity administration (docs/sync).

Signs in as a superuser with MFA enrolled through the REAL two-step JWT flow (so sessions, token
claims and restricted-session checks are the real ones) and records the real behaviour of roles,
groups, permissions, user lifecycle, sessions, credentials, ledgers and people linking.

Pytest test database only, rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_identity_admin.py
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
SECRET_KEYS = re.compile(r"(^|_)(access|refresh|token|secret|key|challenge|passcode|password|uri|digest|hash|recovery_codes?|qr_code|qr)$", re.I)
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def redact(v, key=""):
    if isinstance(v, dict):
        return {k: redact(x, k) for k, x in v.items()}
    if isinstance(v, list):
        return [redact(x, key) for x in v]
    if isinstance(v, str):
        # Secrets never contain spaces; validation messages always do.
        if key and SECRET_KEYS.search(key) and len(v) > 8 and " " not in v:
            return "<redacted>"
        v = EMAIL.sub("user@example.test", v)
        return v if len(v) <= 140 else v[:140] + "…<truncated>"
    return v


def trim(body):
    """Keep shapes, not volume: first 3 rows of any list."""
    if isinstance(body, dict) and isinstance(body.get("results"), list):
        return {**body, "results": body["results"][:3], "_results_total_in_page": len(body["results"])}
    if isinstance(body, list):
        return {"_bare_list": True, "_len": len(body), "items": body[:3]}
    return body


FLOW: dict[str, dict] = {}


def lookup_id(client, path, code):
    """POST /roles/ and POST /groups/ answer with the submitted fields and NO id: find the row by code."""
    rows = client.get(f"{path}?search={code}").json()
    rows = rows.get("results", rows) if isinstance(rows, dict) else rows
    return next(r["id"] for r in rows if r["code"] == code)


def call(client, name, method, path, data=None):
    fn = getattr(client, method.lower())
    resp = fn(path, data=data, format="json") if data is not None else fn(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    req = {k: ("<redacted>" if SECRET_KEYS.search(k) or k == "code" else v) for k, v in data.items()} if isinstance(data, dict) else data
    FLOW[name] = {
        "request": {"method": method, "path": path, "body": redact(req)},
        "status": resp.status_code,
        "headers": {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Allow") if resp.get(h)},
        "body": redact(trim(body)),
    }
    return resp


def sign_in_with_mfa(email, password, user):
    # Enrolling used the current TOTP step; valid_code() clears the replay marker (backend test helper).
    from apps.identity.tests.mfa_helpers import valid_code

    client = APIClient()
    login = client.post("/api/v1/auth/login/", {"email": email, "password": password}, format="json")
    assert login.status_code == 200 and login.json().get("mfa_required"), login.content
    done = client.post(
        "/api/v1/auth/mfa/challenge/",
        {"challenge": login.json()["challenge"], "code": valid_code(user)},
        format="json",
    )
    assert done.status_code == 200, done.content
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {done.json()['tokens']['access']}")
    return client, done.json()


def sign_in_plain(email, password):
    client = APIClient()
    login = client.post("/api/v1/auth/login/", {"email": email, "password": password}, format="json")
    assert login.status_code == 200, login.content
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['tokens']['access']}")
    return client, login.json()


@pytest.mark.django_db
def test_capture_identity_admin(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.models import Permission, Role, UserRole
    from apps.identity.tests.mfa_helpers import enable_mfa
    from apps.masterdata.models import Person

    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase2!9")
    enable_mfa(admin)
    target = U.create_user(email="target@example.test", password="Target-Pass-Phase2!9")
    target.is_active = True
    target.save()
    artist = U.create_user(email="artist@example.test", password="Artist-Pass-Phase2!9")
    UserRole.objects.create(user=artist, role=Role.objects.get(code="artist"))
    mfa_user = U.create_user(email="mfauser@example.test", password="MfaUser-Pass-Phase2!9")
    mfa_user.is_active = True
    mfa_user.save()
    codes = enable_mfa(mfa_user)

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase2!9", admin)
    me = a.get("/api/v1/auth/me/").json()
    FLOW["admin_me"] = {"status": 200, "body": redact({k: me[k] for k in ("role", "is_superuser", "permissions", "must_change_password")})}

    # ----------------------------------------------------------------- permissions catalog
    call(a, "permissions_list", "GET", "/api/v1/permissions/?page_size=3")
    call(a, "permissions_filter_module", "GET", "/api/v1/permissions/?module=shots&page_size=50")
    call(a, "permissions_search", "GET", "/api/v1/permissions/?search=shot.view")
    perm_view = Permission.objects.get(code="shot.view")
    perm_update = Permission.objects.get(code="shot.update")
    call(a, "permissions_detail", "GET", f"/api/v1/permissions/{perm_view.id}/")

    # ----------------------------------------------------------------- roles
    call(a, "roles_list", "GET", "/api/v1/roles/")
    call(a, "roles_list_ordered", "GET", "/api/v1/roles/?ordering=priority&page_size=2")
    artist_role = Role.objects.get(code="artist")
    call(a, "roles_detail_system", "GET", f"/api/v1/roles/{artist_role.id}/")
    call(a, "roles_create_missing", "POST", "/api/v1/roles/", {})
    created = call(a, "roles_create", "POST", "/api/v1/roles/", {"name": "Reviewer", "code": "reviewer", "description": "Reads and reviews", "priority": 50, "scope": "project"})
    call(a, "roles_create_duplicate_code", "POST", "/api/v1/roles/", {"name": "Reviewer 2", "code": "reviewer"})
    FLOW["roles_create_has_id"] = {"status": 200, "body": {"id_in_create_response": "id" in created.json()}}
    rid = lookup_id(a, "/api/v1/roles/", "reviewer")
    call(a, "roles_patch", "PATCH", f"/api/v1/roles/{rid}/", {"description": "Reads, reviews and comments"})
    call(a, "roles_permissions_get_empty", "GET", f"/api/v1/roles/{rid}/permissions/")
    call(a, "roles_permissions_grant", "POST", f"/api/v1/roles/{rid}/permissions/", {"permission_id": str(perm_view.id)})
    call(a, "roles_permissions_grant_expiring", "POST", f"/api/v1/roles/{rid}/permissions/", {"permission_id": str(perm_update.id), "expires_at": "2030-01-01T00:00:00Z"})
    call(a, "roles_permissions_grant_again", "POST", f"/api/v1/roles/{rid}/permissions/", {"permission_id": str(perm_view.id)})
    call(a, "roles_permissions_grant_bad_id", "POST", f"/api/v1/roles/{rid}/permissions/", {"permission_id": "00000000-0000-0000-0000-000000000000"})
    call(a, "roles_permissions_get", "GET", f"/api/v1/roles/{rid}/permissions/")
    call(a, "roles_permissions_revoke", "DELETE", f"/api/v1/roles/{rid}/permissions/", {"permission_id": str(perm_update.id)})
    call(a, "roles_users_assign", "POST", f"/api/v1/roles/{rid}/users/", {"user_id": str(target.id)})
    call(a, "roles_users_get", "GET", f"/api/v1/roles/{rid}/users/")
    t_sess, _t_login = sign_in_plain("target@example.test", "Target-Pass-Phase2!9")
    call(t_sess, "target_me_after_role", "GET", "/api/v1/auth/me/")
    call(a, "roles_users_unassign", "DELETE", f"/api/v1/roles/{rid}/users/", {"user_id": str(target.id)})
    call(a, "roles_delete_system", "DELETE", f"/api/v1/roles/{artist_role.id}/")
    call(a, "roles_patch_system_code", "PATCH", f"/api/v1/roles/{artist_role.id}/", {"code": "renamed"})

    # ----------------------------------------------------------------- groups
    call(a, "groups_list", "GET", "/api/v1/groups/")
    g = call(a, "groups_create", "POST", "/api/v1/groups/", {"name": "Lighting crew", "code": "lighting-crew", "description": "All lighters"})
    FLOW["groups_create_has_id"] = {"status": 200, "body": {"id_in_create_response": "id" in g.json()}}
    gid = lookup_id(a, "/api/v1/groups/", "lighting-crew")
    call(a, "groups_create_duplicate", "POST", "/api/v1/groups/", {"name": "Lighting crew", "code": "lighting-crew"})
    call(a, "groups_members_add", "POST", f"/api/v1/groups/{gid}/members/", {"user_id": str(target.id)})
    call(a, "groups_members_add_owner", "POST", f"/api/v1/groups/{gid}/members/", {"user_id": str(artist.id), "is_owner": True})
    call(a, "groups_members_get", "GET", f"/api/v1/groups/{gid}/members/")
    call(a, "groups_members_remove", "DELETE", f"/api/v1/groups/{gid}/members/", {"user_id": str(artist.id)})
    call(a, "groups_roles_attach", "POST", f"/api/v1/groups/{gid}/roles/", {"role_id": str(rid)})
    call(a, "groups_roles_get", "GET", f"/api/v1/groups/{gid}/roles/")
    call(a, "groups_roles_detach", "DELETE", f"/api/v1/groups/{gid}/roles/", {"role_id": str(rid)})
    call(a, "roles_groups_get", "GET", f"/api/v1/roles/{rid}/groups/")
    call(a, "groups_delete", "DELETE", f"/api/v1/groups/{gid}/")
    call(a, "roles_delete_custom", "DELETE", f"/api/v1/roles/{rid}/")

    # ----------------------------------------------------------------- users
    call(a, "users_list", "GET", "/api/v1/identity/users/")
    call(a, "users_list_search", "GET", "/api/v1/identity/users/?email=target")
    call(a, "users_detail", "GET", f"/api/v1/identity/users/{target.id}/")
    call(a, "users_create_missing", "POST", "/api/v1/identity/users/", {})
    call(a, "users_create_weak", "POST", "/api/v1/identity/users/", {"email": "new@example.test", "password": "123"})
    nu = call(a, "users_create", "POST", "/api/v1/identity/users/", {"email": "new@example.test", "password": "New-User-Pass-Phase2!9"})
    call(a, "users_create_duplicate_exact", "POST", "/api/v1/identity/users/", {"email": "new@example.test", "password": "New-User-Pass-Phase2!9"})
    call(a, "users_create_duplicate_case", "POST", "/api/v1/identity/users/", {"email": "NEW@example.test", "password": "New-User-Pass-Phase2!9"})
    nid = nu.json().get("id")
    call(a, "users_patch", "PATCH", f"/api/v1/identity/users/{nid}/", {"is_staff": False})
    for action in ("deactivate", "activate", "suspend", "unsuspend", "force-password-change", "revoke-sessions", "archive", "restore"):
        call(a, f"users_{action.replace('-', '_')}", "POST", f"/api/v1/identity/users/{nid}/{action}/")
    call(a, "users_reset_password", "POST", f"/api/v1/identity/users/{nid}/reset-password/")
    call(a, "users_detail_after", "GET", f"/api/v1/identity/users/{nid}/")
    call(a, "users_delete", "DELETE", f"/api/v1/identity/users/{nid}/")
    art, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase2!9")
    call(art, "users_list_as_artist", "GET", "/api/v1/identity/users/")
    call(art, "users_create_as_artist", "POST", "/api/v1/identity/users/", {"email": "x@example.test", "password": "Xx-Pass-Phase2!9999"})
    call(art, "roles_create_as_artist", "POST", "/api/v1/roles/", {"name": "X", "code": "x"})
    call(art, "roles_list_as_artist", "GET", "/api/v1/roles/")
    call(art, "ledger_security_events_as_artist", "GET", "/api/v1/identity/security-events/")

    # ----------------------------------------------------------------- people link / unlink
    person = Person.objects.create(name="Linda Linker")
    call(a, "people_detail", "GET", f"/api/v1/people/{person.id}/")
    call(a, "people_link_user", "POST", f"/api/v1/people/{person.id}/link-user/", {"user": str(target.id)})
    other = Person.objects.create(name="Second Person")
    call(a, "people_link_user_already_linked", "POST", f"/api/v1/people/{other.id}/link-user/", {"user": str(target.id)})
    call(a, "people_link_user_unknown", "POST", f"/api/v1/people/{other.id}/link-user/", {"user": "00000000-0000-0000-0000-000000000000"})
    call(a, "people_link_user_missing", "POST", f"/api/v1/people/{other.id}/link-user/", {})
    call(a, "people_unlink_user", "POST", f"/api/v1/people/{person.id}/unlink-user/")

    # ----------------------------------------------------------------- sessions (my account)
    call(a, "sessions_list", "GET", "/api/v1/identity/sessions/")
    call(a, "sessions_current", "GET", "/api/v1/identity/sessions/current/")
    other_session, _ = sign_in_plain("target@example.test", "Target-Pass-Phase2!9")
    call(a, "sessions_admin_list", "GET", f"/api/v1/identity/sessions/admin/{target.id}/")
    call(other_session, "sessions_target_list", "GET", "/api/v1/identity/sessions/")
    call(a, "sessions_admin_revoke_all", "POST", f"/api/v1/identity/sessions/admin/{target.id}/revoke-all/")
    call(other_session, "sessions_target_after_admin_revoke", "GET", "/api/v1/auth/me/")
    call(a, "sessions_revoke_all_other", "POST", "/api/v1/identity/sessions/revoke-all-other/")

    # ----------------------------------------------------------------- credentials
    held = sorted(me["permissions"])[:2]
    call(a, "pat_create_no_scopes", "POST", "/api/v1/identity/personal-access-tokens/", {"name": "ci"})
    call(a, "pat_create_empty_scopes", "POST", "/api/v1/identity/personal-access-tokens/", {"name": "ci", "scopes": []})
    call(a, "pat_create_bad_scope", "POST", "/api/v1/identity/personal-access-tokens/", {"name": "ci", "scopes": ["not a code"]})
    call(art, "pat_create_scope_not_held", "POST", "/api/v1/identity/personal-access-tokens/", {"name": "ci", "scopes": ["identity.role.update"]})
    pat = call(a, "pat_create", "POST", "/api/v1/identity/personal-access-tokens/", {"name": "CI token", "description": "for CI", "scopes": held, "expires_at": "2030-01-01T00:00:00Z"})
    pid = pat.json().get("id")
    call(a, "pat_list", "GET", "/api/v1/identity/personal-access-tokens/")
    call(a, "pat_rotate", "POST", f"/api/v1/identity/personal-access-tokens/{pid}/rotate/")
    call(a, "pat_list_after_rotate", "GET", "/api/v1/identity/personal-access-tokens/?include_revoked=true")
    key = call(a, "apikey_create", "POST", "/api/v1/identity/api-keys/", {"name": "Integration", "scopes": held})
    kid = key.json().get("id")
    call(a, "apikey_list", "GET", "/api/v1/identity/api-keys/")
    call(a, "apikey_delete", "DELETE", f"/api/v1/identity/api-keys/{kid}/")
    call(a, "apikey_list_after_delete", "GET", "/api/v1/identity/api-keys/")

    # ----------------------------------------------------------------- MFA management (a normal user)
    m, _ = sign_in_with_mfa("mfauser@example.test", "MfaUser-Pass-Phase2!9", mfa_user)
    call(m, "mfa_config", "GET", "/api/v1/identity/mfa/config/")
    call(m, "mfa_recovery_get", "GET", "/api/v1/identity/mfa/recovery-codes/")
    call(m, "mfa_recovery_regenerate_no_password", "POST", "/api/v1/identity/mfa/recovery-codes/regenerate/", {})
    call(m, "mfa_recovery_regenerate_wrong_password", "POST", "/api/v1/identity/mfa/recovery-codes/regenerate/", {"password": "wrong-password-1"})
    call(m, "mfa_recovery_regenerate_ok", "POST", "/api/v1/identity/mfa/recovery-codes/regenerate/", {"password": "MfaUser-Pass-Phase2!9"})
    call(m, "mfa_devices_revoke_unknown", "POST", "/api/v1/identity/auth/mfa/devices/revoke/", {"device_id": "00000000-0000-0000-0000-000000000000"})
    call(m, "mfa_devices", "GET", "/api/v1/identity/auth/mfa/devices/")
    call(m, "mfa_trusted_devices", "GET", "/api/v1/identity/trusted-devices/")
    call(m, "mfa_disable_no_password", "POST", "/api/v1/identity/mfa/totp/disable/", {})
    call(m, "mfa_disable_wrong_password", "POST", "/api/v1/identity/mfa/totp/disable/", {"password": "wrong-password-1"})
    call(a, "mfa_admin_reset_other", "POST", f"/api/v1/identity/mfa/admin/reset/{mfa_user.id}/")
    call(m, "mfa_config_after_admin_reset", "GET", "/api/v1/identity/mfa/config/")

    # ----------------------------------------------------------------- profile
    call(a, "me_patch_ok", "PATCH", "/api/v1/auth/me/", {"first_name": "Root", "last_name": "Admin", "timezone": "Asia/Kolkata", "language": "en"})
    call(a, "me_patch_invalid_url", "PATCH", "/api/v1/auth/me/", {"avatar_url": "nope"})
    call(a, "me_patch_ignored_fields", "PATCH", "/api/v1/auth/me/", {"is_superuser": False, "email": "x@example.test"})
    call(a, "me_after_patch", "GET", "/api/v1/auth/me/")

    # ----------------------------------------------------------------- ledgers
    call(a, "ledger_security_events", "GET", "/api/v1/identity/security-events/")
    call(a, "ledger_login_history", "GET", "/api/v1/identity/login-history/")
    call(a, "ledger_login_history_filtered", "GET", "/api/v1/identity/login-history/?status=success")
    call(a, "ledger_login_attempts", "GET", "/api/v1/identity/login-attempts/")
    call(a, "ledger_ip_blacklist_empty", "GET", "/api/v1/identity/ip-blacklist/")
    ip = call(a, "ledger_ip_blacklist_create", "POST", "/api/v1/identity/ip-blacklist/", {"ip_address": "203.0.113.7", "description": "scanner"})
    call(a, "ledger_ip_blacklist_create_invalid", "POST", "/api/v1/identity/ip-blacklist/", {"ip_address": "not-an-ip"})
    iid = ip.json().get("id")
    call(a, "ledger_ip_blacklist_deactivate", "POST", f"/api/v1/identity/ip-blacklist/{iid}/deactivate/")
    call(a, "ledger_ip_blacklist_activate", "POST", f"/api/v1/identity/ip-blacklist/{iid}/activate/")
    call(a, "ledger_ip_blacklist_delete", "DELETE", f"/api/v1/identity/ip-blacklist/{iid}/")

    # ----------------------------------------------------------------- self-protection (throwaway admin)
    victim = U.create_superuser(email="victim@example.test", password="Victim-Pass-Phase2!9")
    enable_mfa(victim)
    v, _ = sign_in_with_mfa("victim@example.test", "Victim-Pass-Phase2!9", victim)
    call(v, "self_deactivate", "POST", f"/api/v1/identity/users/{victim.id}/deactivate/")
    call(v, "self_after_deactivate_me", "GET", "/api/v1/auth/me/")
    victim2 = U.create_superuser(email="victim2@example.test", password="Victim2-Pass-Phase2!9")
    enable_mfa(victim2)
    v2, _ = sign_in_with_mfa("victim2@example.test", "Victim2-Pass-Phase2!9", victim2)
    call(v2, "self_delete", "DELETE", f"/api/v1/identity/users/{victim2.id}/")
    call(v2, "self_after_delete_me", "GET", "/api/v1/auth/me/")

    (OUT / "identity").mkdir(parents=True, exist_ok=True)
    (OUT / "identity" / "_identity_admin_flow.json").write_text(json.dumps(FLOW, indent=2, default=str) + "\n")
