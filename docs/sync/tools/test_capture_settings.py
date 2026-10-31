"""
Phase 11 sample capture: system settings (categories, definitions, values, locks), feature flags, themes,
localizations and tags (docs/sync).

Real JWT flow for an MFA superuser and the seeded roles that matter: a production-admin, a vfx-supervisor, an
artist and a user with no role. Every call is recorded whatever its status, so failures are data. Pytest test
database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_settings.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_capture_identity_admin import FLOW, call, redact, sign_in_plain, sign_in_with_mfa  # noqa: E402

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
S = "/api/v1/settings/"
T = "/api/v1/core/tags/"


def _user(U, email, password, role_code=None):
    from apps.identity.models import Role, UserRole

    user = U.create_user(email=email, password=password)
    user.is_active = True
    user.save()
    if role_code:
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
    return user


@pytest.mark.django_db
def test_capture_settings(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.tests.mfa_helpers import enable_mfa

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase11!1")
    enable_mfa(admin)
    _user(U, "sup@example.test", "Sup-Pass-Phase11!1", "vfx-supervisor")
    _user(U, "padmin@example.test", "Padmin-Pass-Phase11!1", "production-admin")
    _user(U, "artist@example.test", "Artist-Pass-Phase11!1", "artist")
    _user(U, "norole@example.test", "Norole-Pass-Phase11!1")

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase11!1", admin)
    sv, _ = sign_in_plain("sup@example.test", "Sup-Pass-Phase11!1")
    pa, _ = sign_in_plain("padmin@example.test", "Padmin-Pass-Phase11!1")
    ar, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase11!1")
    nr, _ = sign_in_plain("norole@example.test", "Norole-Pass-Phase11!1")

    # ------------------------------------------------------------ categories
    call(a, "categories_list_empty", "GET", f"{S}categories/")
    c1 = call(a, "categories_create", "POST", f"{S}categories/", {"code": "workflow", "name": "Pipeline", "description": "Pipeline defaults", "icon": "layers", "order": 1}).json().get("id")
    call(a, "categories_create_duplicate", "POST", f"{S}categories/", {"code": "workflow", "name": "Again"})
    call(a, "categories_create_bad_code", "POST", f"{S}categories/", {"code": "pipeline", "name": "Not on the list"})
    call(a, "categories_create_empty", "POST", f"{S}categories/", {})
    c2 = call(a, "categories_create_second", "POST", f"{S}categories/", {"code": "general", "name": "Studio", "order": 2}).json().get("id")
    call(pa, "categories_create_padmin", "POST", f"{S}categories/", {"code": "media", "name": "By padmin"})
    call(sv, "categories_create_supervisor", "POST", f"{S}categories/", {"code": "review", "name": "By supervisor"})
    call(ar, "categories_create_artist", "POST", f"{S}categories/", {"code": "delivery", "name": "By artist"})
    call(a, "categories_list", "GET", f"{S}categories/")
    call(pa, "categories_list_padmin", "GET", f"{S}categories/")
    call(sv, "categories_list_supervisor", "GET", f"{S}categories/")
    call(ar, "categories_list_artist", "GET", f"{S}categories/")
    call(nr, "categories_list_norole", "GET", f"{S}categories/")
    call(a, "categories_detail", "GET", f"{S}categories/{c1}/")
    call(a, "categories_patch", "PATCH", f"{S}categories/{c1}/", {"description": "Pipeline defaults v2"})
    call(a, "categories_archive", "POST", f"{S}categories/{c2}/archive/", {})
    call(a, "categories_list_after_archive", "GET", f"{S}categories/")
    call(a, "categories_restore", "POST", f"{S}categories/{c2}/restore/", {})
    call(a, "categories_baseline", "GET", f"{S}categories/")
    for name, value in (("is_active", "false"), ("code", "general"), ("code__icontains", "work"), ("search", "pipe"), ("nonsense", "1")):
        call(a, f"categories_by_{name}", "GET", f"{S}categories/?{name}={value}")

    # ------------------------------------------------------------ definitions
    d_int = call(a, "definitions_create_integer", "POST", f"{S}definitions/", {"code": "default_fps", "name": "Default FPS", "category": c1, "data_type": "integer", "default_value": "24", "is_required": True, "validation_rules": {"min": 1, "max": 120}}).json().get("id")
    d_str = call(a, "definitions_create_string", "POST", f"{S}definitions/", {"code": "studio_name", "name": "Studio name", "category": c2, "data_type": "string", "default_value": "Apex", "validation_rules": {"min_length": 2}}).json().get("id")
    d_bool = call(a, "definitions_create_boolean", "POST", f"{S}definitions/", {"code": "ai_denoise", "name": "AI denoising", "category": c1, "data_type": "boolean", "default_value": "false"}).json().get("id")
    call(a, "definitions_create_select_strings", "POST", f"{S}definitions/", {"code": "farm_strings", "name": "Farm (plain strings)", "category": c1, "data_type": "select", "choices": ["Deadline", "Tractor"], "default_value": "Deadline"})
    d_sel = call(a, "definitions_create_select", "POST", f"{S}definitions/", {"code": "farm_engine", "name": "Farm engine", "category": c1, "data_type": "select", "choices": [{"value": "Deadline", "label": "Deadline"}, {"value": "Tractor", "label": "Tractor"}], "default_value": "Deadline"}).json().get("id")
    call(a, "definitions_create_duplicate", "POST", f"{S}definitions/", {"code": "default_fps", "name": "Again", "category": c1, "data_type": "integer"})
    call(a, "definitions_create_bad_type", "POST", f"{S}definitions/", {"code": "bad_type", "name": "Bad", "category": c1, "data_type": "banana"})
    call(a, "definitions_create_empty", "POST", f"{S}definitions/", {})
    call(a, "definitions_create_no_category", "POST", f"{S}definitions/", {"code": "no_cat", "name": "No category", "data_type": "string"})
    call(ar, "definitions_create_artist", "POST", f"{S}definitions/", {"code": "art_def", "name": "Art", "category": c1, "data_type": "string"})
    call(a, "definitions_list_ids", "GET", f"{S}definitions/")
    call(a, "definitions_list", "GET", f"{S}definitions/")
    call(ar, "definitions_list_artist", "GET", f"{S}definitions/")
    call(a, "definitions_detail", "GET", f"{S}definitions/{d_int}/")
    call(a, "definitions_patch", "PATCH", f"{S}definitions/{d_int}/", {"help_text": "Frames per second"})
    call(a, "definitions_patch_code", "PATCH", f"{S}definitions/{d_int}/", {"code": "renamed"})
    call(a, "definitions_archive", "POST", f"{S}definitions/{d_bool}/archive/", {})
    call(a, "definitions_restore", "POST", f"{S}definitions/{d_bool}/restore/", {})
    call(a, "definitions_baseline", "GET", f"{S}definitions/")
    for name, value in (("category", c2), ("category_id", c2), ("data_type", "integer"), ("is_active", "false"), ("is_required", "true"), ("search", "fps"), ("nonsense", "1")):
        call(a, f"definitions_by_{name}", "GET", f"{S}definitions/?{name}={value}")

    # ------------------------------------------------------------ system settings (values)
    s_int = call(a, "values_create_integer", "POST", f"{S}system-settings/", {"setting": d_int, "value": "30"}).json().get("id")
    call(a, "values_create_duplicate", "POST", f"{S}system-settings/", {"setting": d_int, "value": "25"})
    call(a, "values_create_bad_integer", "POST", f"{S}system-settings/", {"setting": d_str, "value": "x"})
    s_str = call(a, "values_create_string", "POST", f"{S}system-settings/", {"setting": d_str, "value": "Apex VFX"}).json().get("id")
    call(a, "values_create_empty", "POST", f"{S}system-settings/", {})
    call(a, "values_create_unknown_setting", "POST", f"{S}system-settings/", {"setting": 999999, "value": "1"})
    call(ar, "values_create_artist", "POST", f"{S}system-settings/", {"setting": d_sel, "value": "Tractor"})
    call(a, "values_create_select_bad_choice", "POST", f"{S}system-settings/", {"setting": d_sel, "value": "Banana"})
    s_sel = call(a, "values_create_select", "POST", f"{S}system-settings/", {"setting": d_sel, "value": "Tractor"}).json().get("id")
    d_strs = [d["id"] for d in call(a, "definitions_list_ids", "GET", f"{S}definitions/").json() if d["code"] == "farm_strings"][0:1]
    if d_strs:
        call(a, "values_create_select_with_string_choices", "POST", f"{S}system-settings/", {"setting": d_strs[0], "value": "Tractor"})
    call(a, "values_list", "GET", f"{S}system-settings/")
    call(ar, "values_list_artist", "GET", f"{S}system-settings/")
    call(nr, "values_list_norole", "GET", f"{S}system-settings/")
    call(a, "values_detail", "GET", f"{S}system-settings/{s_int}/")
    call(a, "values_patch", "PATCH", f"{S}system-settings/{s_int}/", {"value": "48"})
    call(a, "values_patch_invalid", "PATCH", f"{S}system-settings/{s_int}/", {"value": "forty"})
    call(a, "values_patch_empty_value", "PATCH", f"{S}system-settings/{s_int}/", {"value": ""})
    call(pa, "values_lock_padmin", "POST", f"{S}system-settings/{s_int}/lock/", {})
    call(a, "values_lock", "POST", f"{S}system-settings/{s_int}/lock/", {})
    call(a, "values_lock_again", "POST", f"{S}system-settings/{s_int}/lock/", {})
    call(a, "values_detail_locked", "GET", f"{S}system-settings/{s_int}/")
    call(a, "values_patch_locked", "PATCH", f"{S}system-settings/{s_int}/", {"value": "50"})
    call(a, "values_delete_locked", "DELETE", f"{S}system-settings/{s_int}/")
    call(a, "values_unlock", "POST", f"{S}system-settings/{s_int}/unlock/", {})
    call(a, "values_unlock_again", "POST", f"{S}system-settings/{s_int}/unlock/", {})
    call(a, "values_delete", "DELETE", f"{S}system-settings/{s_sel}/")
    call(a, "values_detail_deleted", "GET", f"{S}system-settings/{s_sel}/")
    call(a, "values_baseline", "GET", f"{S}system-settings/")
    for name, value in (("setting", d_str), ("is_locked", "true"), ("search", "fps"), ("category", c1), ("nonsense", "1")):
        call(a, f"values_by_{name}", "GET", f"{S}system-settings/?{name}={value}")

    # ------------------------------------------------------------ feature flags
    call(nr, "flags_list_norole_empty", "GET", f"{S}feature-flags/")
    f1 = call(a, "flags_create", "POST", f"{S}feature-flags/", {"code": "new_review_ui", "name": "New review UI", "description": "Redesigned review page", "feature_type": "boolean", "is_enabled": False}).json().get("id")
    f2 = call(a, "flags_create_percentage", "POST", f"{S}feature-flags/", {"code": "fast_search", "name": "Fast search", "feature_type": "percentage", "percentage": 25}).json().get("id")
    call(a, "flags_create_duplicate", "POST", f"{S}feature-flags/", {"code": "new_review_ui", "name": "Again"})
    f_on = call(a, "flags_create_is_enabled_true", "POST", f"{S}feature-flags/", {"code": "born_on", "name": "Born on", "is_enabled": True}).json().get("id")
    call(a, "flags_patch_is_enabled", "PATCH", f"{S}feature-flags/{f_on}/", {"is_enabled": False})
    call(a, "flags_patch_status", "PATCH", f"{S}feature-flags/{f_on}/", {"status": "enabled"})
    call(a, "flags_detail_born_on", "GET", f"{S}feature-flags/{f_on}/")
    call(a, "flags_create_empty", "POST", f"{S}feature-flags/", {})
    call(a, "flags_create_bad_type", "POST", f"{S}feature-flags/", {"code": "bad", "name": "Bad", "feature_type": "banana"})
    call(a, "flags_create_bad_percentage", "POST", f"{S}feature-flags/", {"code": "bad2", "name": "Bad", "feature_type": "percentage", "percentage": 150})
    call(ar, "flags_create_artist", "POST", f"{S}feature-flags/", {"code": "art_flag", "name": "Art"})
    call(a, "flags_list", "GET", f"{S}feature-flags/")
    call(ar, "flags_list_artist", "GET", f"{S}feature-flags/")
    call(nr, "flags_list_norole", "GET", f"{S}feature-flags/")
    call(ar, "flags_detail_artist", "GET", f"{S}feature-flags/{f1}/")
    call(a, "flags_patch", "PATCH", f"{S}feature-flags/{f1}/", {"description": "Redesigned review page v2"})
    call(ar, "flags_enable_artist", "POST", f"{S}feature-flags/{f1}/enable/", {})
    call(a, "flags_enable", "POST", f"{S}feature-flags/{f1}/enable/", {})
    call(a, "flags_detail_enabled", "GET", f"{S}feature-flags/{f1}/")
    call(a, "flags_disable", "POST", f"{S}feature-flags/{f1}/disable/", {})
    call(a, "flags_detail_disabled", "GET", f"{S}feature-flags/{f1}/")
    call(a, "flags_schedule", "POST", f"{S}feature-flags/{f2}/schedule/", {"start_date": "2026-12-01T00:00:00Z", "end_date": "2026-12-31T00:00:00Z"})
    call(a, "flags_detail_scheduled", "GET", f"{S}feature-flags/{f2}/")
    call(a, "flags_schedule_empty", "POST", f"{S}feature-flags/{f2}/schedule/", {})
    call(a, "flags_schedule_backwards", "POST", f"{S}feature-flags/{f2}/schedule/", {"start_date": "2027-01-10T00:00:00Z", "end_date": "2027-01-01T00:00:00Z"})
    call(a, "flags_schedule_bad_date", "POST", f"{S}feature-flags/{f2}/schedule/", {"start_date": "soon", "end_date": "later"})
    call(a, "flags_schedule_naive", "POST", f"{S}feature-flags/{f2}/schedule/", {"start_date": "2026-12-01T00:00:00", "end_date": "2026-12-31T00:00:00"})
    f3 = call(a, "flags_create_for_delete", "POST", f"{S}feature-flags/", {"code": "throwaway", "name": "Throwaway"}).json().get("id")
    call(ar, "flags_delete_artist", "DELETE", f"{S}feature-flags/{f3}/")
    call(a, "flags_delete", "DELETE", f"{S}feature-flags/{f3}/")
    call(a, "flags_baseline", "GET", f"{S}feature-flags/")
    for name, value in (("status", "scheduled"), ("feature_type", "percentage"), ("is_enabled", "true"), ("code", "fast_search"), ("code__icontains", "review"), ("search", "search"), ("nonsense", "1")):
        call(a, f"flags_by_{name}", "GET", f"{S}feature-flags/?{name}={value}")

    # ------------------------------------------------------------ themes
    call(ar, "themes_default_none", "GET", f"{S}themes/default/")
    t1 = call(a, "themes_create", "POST", f"{S}themes/", {"code": "studio-dark", "name": "Studio dark", "theme_type": "dark", "primary_color": "#06b6d4", "background_color": "#020617", "font_family": "sans", "font_size": 14, "border_radius": 8}).json().get("id")
    t2 = call(a, "themes_create_second", "POST", f"{S}themes/", {"code": "studio-light", "name": "Studio light", "theme_type": "light", "primary_color": "#0e7490"}).json().get("id")
    call(a, "themes_create_duplicate", "POST", f"{S}themes/", {"code": "studio-dark", "name": "Again"})
    call(a, "themes_create_empty", "POST", f"{S}themes/", {})
    call(a, "themes_create_bad_color", "POST", f"{S}themes/", {"code": "bad-color", "name": "Bad", "primary_color": "not-a-color"})
    call(a, "themes_create_bad_type", "POST", f"{S}themes/", {"code": "bad-type", "name": "Bad", "theme_type": "banana"})
    call(ar, "themes_create_artist", "POST", f"{S}themes/", {"code": "art", "name": "Art"})
    call(a, "themes_list", "GET", f"{S}themes/")
    call(ar, "themes_list_artist", "GET", f"{S}themes/")
    call(a, "themes_detail", "GET", f"{S}themes/{t1}/")
    call(a, "themes_patch", "PATCH", f"{S}themes/{t1}/", {"accent_color": "#f59e0b"})
    call(a, "themes_activate", "POST", f"{S}themes/{t1}/activate/", {})
    call(a, "themes_activate_second", "POST", f"{S}themes/{t2}/activate/", {})
    call(a, "themes_list_after_activate", "GET", f"{S}themes/")
    call(a, "themes_deactivate", "POST", f"{S}themes/{t2}/deactivate/", {})
    call(a, "themes_deactivate_again", "POST", f"{S}themes/{t2}/deactivate/", {})
    call(ar, "themes_activate_artist", "POST", f"{S}themes/{t1}/activate/", {})
    call(a, "themes_activate_back", "POST", f"{S}themes/{t1}/activate/", {})
    # Q-22: exactly one default (the one the app uses); the first active one made becomes it
    call(a, "themes_default", "GET", f"{S}themes/default/")
    call(ar, "themes_default_artist", "GET", f"{S}themes/default/")
    call(ar, "themes_set_default_artist", "POST", f"{S}themes/{t2}/set-default/", {})
    call(a, "themes_set_default_inactive", "POST", f"{S}themes/{t2}/set-default/", {})
    call(a, "themes_deactivate_default", "POST", f"{S}themes/{t1}/deactivate/", {})
    call(a, "themes_patch_deactivate_default", "PATCH", f"{S}themes/{t1}/", {"is_active": False})
    call(a, "themes_activate_second_again", "POST", f"{S}themes/{t2}/activate/", {})
    call(a, "themes_set_default", "POST", f"{S}themes/{t2}/set-default/", {})
    call(a, "themes_default_after", "GET", f"{S}themes/default/")
    call(a, "themes_list_after_default", "GET", f"{S}themes/")
    call(a, "themes_by_is_default", "GET", f"{S}themes/?is_default=true")
    call(a, "themes_delete_new_default", "DELETE", f"{S}themes/{t2}/")
    call(a, "themes_set_default_back", "POST", f"{S}themes/{t1}/set-default/", {})
    call(a, "themes_baseline", "GET", f"{S}themes/")
    for name, value in (("is_active", "false"), ("theme_type", "light"), ("code", "studio-dark"), ("code__icontains", "light"), ("search", "light"), ("nonsense", "1")):
        call(a, f"themes_by_{name}", "GET", f"{S}themes/?{name}={value}")
    call(a, "themes_delete_active", "DELETE", f"{S}themes/{t1}/")
    call(a, "themes_delete", "DELETE", f"{S}themes/{t2}/")

    # ------------------------------------------------------------ localizations
    call(ar, "locales_default_none", "GET", f"{S}localizations/default/")
    l1 = call(a, "locales_create", "POST", f"{S}localizations/", {"code": "en-gb", "name": "English (UK)", "language": "en", "timezone": "Europe/London", "date_format": "DD/MM/YYYY", "time_format": "24H", "currency_code": "GBP", "currency_symbol": "£", "week_start": 1}).json().get("id")
    l2 = call(a, "locales_create_second", "POST", f"{S}localizations/", {"code": "en-in", "name": "English (India)", "language": "en", "timezone": "Asia/Kolkata", "date_format": "DD-MM-YYYY", "currency_code": "INR", "currency_symbol": "₹"}).json().get("id")
    call(a, "locales_create_duplicate", "POST", f"{S}localizations/", {"code": "en-gb", "name": "Again", "language": "en"})
    call(a, "locales_create_empty", "POST", f"{S}localizations/", {})
    call(a, "locales_create_bad_language", "POST", f"{S}localizations/", {"code": "xx", "name": "X", "language": "klingon"})
    call(a, "locales_create_bad_zone", "POST", f"{S}localizations/", {"code": "xz", "name": "X", "language": "en", "timezone": "Mars/Olympus"})
    call(a, "locales_create_bad_week", "POST", f"{S}localizations/", {"code": "xw", "name": "X", "language": "en", "week_start": 9})
    call(ar, "locales_create_artist", "POST", f"{S}localizations/", {"code": "art", "name": "Art", "language": "en"})
    call(a, "locales_list", "GET", f"{S}localizations/")
    call(ar, "locales_list_artist", "GET", f"{S}localizations/")
    call(a, "locales_detail", "GET", f"{S}localizations/{l1}/")
    call(a, "locales_patch", "PATCH", f"{S}localizations/{l1}/", {"time_format": "12H"})
    call(a, "locales_activate", "POST", f"{S}localizations/{l1}/activate/", {})
    call(a, "locales_activate_second", "POST", f"{S}localizations/{l2}/activate/", {})
    call(a, "locales_list_after_activate", "GET", f"{S}localizations/")
    call(a, "locales_deactivate", "POST", f"{S}localizations/{l2}/deactivate/", {})
    call(ar, "locales_activate_artist", "POST", f"{S}localizations/{l1}/activate/", {})
    # Q-22: exactly one default localization
    call(a, "locales_default", "GET", f"{S}localizations/default/")
    call(ar, "locales_default_artist", "GET", f"{S}localizations/default/")
    call(ar, "locales_set_default_artist", "POST", f"{S}localizations/{l2}/set-default/", {})
    call(a, "locales_set_default_inactive", "POST", f"{S}localizations/{l2}/set-default/", {})
    call(a, "locales_deactivate_default", "POST", f"{S}localizations/{l1}/deactivate/", {})
    call(a, "locales_activate_second_again", "POST", f"{S}localizations/{l2}/activate/", {})
    call(a, "locales_set_default", "POST", f"{S}localizations/{l2}/set-default/", {})
    call(a, "locales_default_after", "GET", f"{S}localizations/default/")
    call(a, "locales_by_is_default", "GET", f"{S}localizations/?is_default=true")
    call(a, "locales_delete_new_default", "DELETE", f"{S}localizations/{l2}/")
    call(a, "locales_set_default_back", "POST", f"{S}localizations/{l1}/set-default/", {})
    call(a, "locales_baseline", "GET", f"{S}localizations/")
    for name, value in (("is_active", "false"), ("language", "fr"), ("timezone", "Asia/Kolkata"), ("code__icontains", "gb"), ("search", "uk"), ("nonsense", "1")):
        call(a, f"locales_by_{name}", "GET", f"{S}localizations/?{name}={value}")
    call(a, "locales_delete", "DELETE", f"{S}localizations/{l2}/")

    # ------------------------------------------------------------ tags (core; reads for any signed-in user, writes need settings.manage, CR-28)
    call(ar, "tags_list_empty", "GET", T)
    call(ar, "tags_create_artist", "POST", T, {"name": "hero", "description": "Hero shots", "color": "#f59e0b"})
    tg1 = call(a, "tags_create", "POST", T, {"name": "hero", "description": "Hero shots", "color": "#f59e0b"}).json().get("id")
    tg2 = call(a, "tags_create_system", "POST", T, {"name": "client-facing", "color": "#22c55e", "is_system": True}).json().get("id")
    call(ar, "tags_create_system_by_artist", "POST", T, {"name": "sneaky-system", "is_system": True})
    call(a, "tags_create_duplicate", "POST", T, {"name": "hero"})
    call(a, "tags_create_empty", "POST", T, {})
    call(a, "tags_create_bad_color", "POST", T, {"name": "bad", "color": "red"})
    call(nr, "tags_create_norole", "POST", T, {"name": "norole-tag"})
    call(ar, "tags_list", "GET", T)
    call(ar, "tags_detail", "GET", f"{T}{tg1}/")
    call(a, "tags_patch", "PATCH", f"{T}{tg1}/", {"description": "Hero shots v2"})
    call(ar, "tags_patch_artist", "PATCH", f"{T}{tg1}/", {"description": "mine now"})
    call(ar, "tags_patch_system_by_artist", "PATCH", f"{T}{tg2}/", {"name": "hijacked"})
    call(a, "tags_patch_is_system", "PATCH", f"{T}{tg1}/", {"is_system": True})
    call(ar, "tags_delete_system_by_artist", "DELETE", f"{T}{tg2}/")
    call(a, "tags_delete", "DELETE", f"{T}{tg1}/")
    call(ar, "tags_detail_deleted", "GET", f"{T}{tg1}/")
    for name, value in (("is_system", "true"), ("search", "client"), ("nonsense", "1")):
        call(a, f"tags_by_{name}", "GET", f"{T}?{name}={value}")

    (OUT / "settings").mkdir(parents=True, exist_ok=True)
    (OUT / "settings" / "_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
    assert FLOW["categories_create"]["status"] in (200, 201), FLOW["categories_create"]
