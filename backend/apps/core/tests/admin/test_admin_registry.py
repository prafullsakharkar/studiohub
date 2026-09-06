"""
Automated discovery check: every concrete StudioHub model must have an
intentional admin decision.

Add a label to ``INTENTIONALLY_UNREGISTERED`` (with a reason comment) to
exempt a model; any other unregistered concrete model fails this test.
"""

from __future__ import annotations

import pytest
from django.apps import apps
from django.contrib import admin
from django.urls import NoReverseMatch, reverse

STUDIOHUB_APP_LABELS = frozenset(
    {
        "core",
        "identity",
        "organization",
        "settings",
        "audit",
        "production",
        "intelligence",
        "deliveries",
        "publishing",
        "scheduling",
    }
)

# Models deliberately kept out of Django Admin (label -> reason).
INTENTIONALLY_UNREGISTERED: dict[str, str] = {
    # (none — every concrete StudioHub model is currently registered)
}


def _concrete_studiohub_models():
    return [
        model
        for model in apps.get_models(include_auto_created=False)
        if model._meta.app_label in STUDIOHUB_APP_LABELS
        and not model._meta.proxy
        and not model._meta.abstract
    ]


class TestAdminRegistryDiscovery:
    def test_all_concrete_models_registered(self):
        missing = [
            model._meta.label
            for model in _concrete_studiohub_models()
            if model not in admin.site._registry
            and model._meta.label not in INTENTIONALLY_UNREGISTERED
        ]

        assert missing == []

    def test_no_duplicate_registrations(self):
        seen = {}
        for model, model_admin in admin.site._registry.items():
            label = getattr(model._meta, "label", None)
            if label is None:
                continue
            assert label not in seen, f"{label} registered twice"
            seen[label] = model_admin

    def test_every_registration_resolves_admin_urls(self):
        failures = []
        for model in _concrete_studiohub_models():
            if model not in admin.site._registry:
                continue
            url_name = (
                f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist"
            )
            try:
                reverse(url_name)
            except NoReverseMatch:
                failures.append(model._meta.label)

        assert failures == []

    def test_every_admin_class_loads(self):
        from django.contrib.admin.sites import AdminSite

        failures = []
        for model in _concrete_studiohub_models():
            if model not in admin.site._registry:
                continue
            admin_class = type(admin.site._registry[model])
            try:
                admin_class(model, AdminSite())
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{model._meta.label}: {exc}")

        assert failures == []

    def test_reversible_secrets_never_exposed(self):
        from apps.identity.admin.oauth import OAuthAccountAdmin, OAuthProviderAdmin
        from apps.identity.admin.user_mfa import UserMFAdmin

        assert "access_token" in (OAuthAccountAdmin.exclude or ())
        assert "refresh_token" in (OAuthAccountAdmin.exclude or ())
        assert "client_secret" in (OAuthProviderAdmin.exclude or ())
        assert "totp_secret" in (UserMFAdmin.exclude or ())

    @pytest.mark.django_db
    def test_high_volume_admins_are_searchable(self):
        from apps.organization.admin.client import ClientAdmin
        from apps.organization.admin.vendor import VendorAdmin
        from apps.production.admin.project import ProjectAdmin
        from apps.production.admin.shot import ShotAdmin
        from apps.production.admin.task import TaskAdmin
        from apps.production.admin.version import VersionAdmin

        for admin_class in (
            ClientAdmin,
            VendorAdmin,
            ProjectAdmin,
            ShotAdmin,
            TaskAdmin,
            VersionAdmin,
        ):
            assert admin_class.search_fields, admin_class.__name__
            assert admin_class.list_filter, admin_class.__name__
