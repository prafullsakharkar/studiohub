"""
Admin hardening (WP 8.4): security state is view-only, no secret is editable,
and the User form cannot overwrite a password hash with raw text.
"""

from __future__ import annotations

import pytest
from django.contrib import admin
from django.test import Client
from django.urls import reverse

from apps.identity.models import (
    ApiKey,
    BackupCode,
    LoginAttempt,
    LoginHistory,
    PasswordResetToken,
    PersonalAccessToken,
    SecurityEvent,
    TrustedDevice,
    UserMFA,
    UserSession,
)
from apps.identity.tests.factories import UserFactory

VIEW_ONLY = [
    UserMFA,
    BackupCode,
    TrustedDevice,
    UserSession,
    ApiKey,
    PersonalAccessToken,
    LoginAttempt,
    LoginHistory,
    SecurityEvent,
    PasswordResetToken,
]


class _Superuser:
    is_superuser = True
    is_staff = True
    is_active = True
    pk = 1

    def has_perm(self, perm, obj=None):
        return True


def _request():
    from django.test import RequestFactory

    request = RequestFactory().get("/")
    request.user = _Superuser()  # pyright: ignore[reportAttributeAccessIssue]
    return request


@pytest.mark.parametrize("model", VIEW_ONLY, ids=lambda m: m.__name__)
def test_security_models_are_view_only_even_for_a_superuser(model):
    model_admin = admin.site._registry[model]
    request = _request()

    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_change_permission(request) is False
    assert model_admin.has_delete_permission(request) is False


def test_secret_columns_are_never_editable_or_listed():
    request = _request()
    secrets = {
        UserMFA: "totp_secret",
        BackupCode: "code_hash",
        TrustedDevice: "fingerprint",
        ApiKey: "hashed_key",
        PersonalAccessToken: "hashed_token",
    }

    for model, field in secrets.items():
        model_admin = admin.site._registry[model]

        assert field not in (model_admin.list_display or ())
        assert field in model_admin.get_readonly_fields(request) or field in (
            model_admin.exclude or ()
        )


@pytest.mark.django_db
class TestUserAdminPassword:
    def _admin_client(self):
        root = UserFactory.create(is_staff=True, is_superuser=True)
        root.set_password("Admin-pass-9!")
        root.save(update_fields=["password"])
        client = Client()
        client.force_login(root)
        return client

    def test_the_password_field_is_read_only(self):
        request = _request()

        assert "password" in admin.site._registry[type(UserFactory.build())].get_readonly_fields(
            request
        )

    def test_posting_a_new_password_value_cannot_overwrite_the_hash(self):
        target = UserFactory.create()
        target.set_password("Original-pass-9!")
        target.save(update_fields=["password"])
        stored = target.password
        client = self._admin_client()
        url = reverse("admin:identity_user_change", args=[target.pk])

        response = client.post(
            url,
            {
                "email": target.email,
                "password": "plaintext-should-be-ignored",
                "is_active": "on",
            },
        )

        assert response.status_code in (200, 302)
        target.refresh_from_db()
        assert target.password == stored
        assert target.check_password("Original-pass-9!")
