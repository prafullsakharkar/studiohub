"""
Mail transport and client-address settings (TPN review TM-017, TM-014).

Mail settings used to be read from the environment and dropped, so production fell back to Django's
local relay without TLS. The deploy checks refuse the unsafe combinations.
"""

from __future__ import annotations

import pytest
from django.core import mail
from django.test import override_settings

from apps.core import checks
from apps.identity.services.password_reset import PasswordResetService
from apps.identity.tests.factories import UserFactory

SMTP = "django.core.mail.backends.smtp.EmailBackend"


def _ids(findings):
    return sorted(f.id for f in findings)


class TestEnvironmentReachesDjango:
    def test_the_mail_settings_exist_and_follow_the_environment_loader(self):
        from django.conf import settings

        from config.env import settings as env

        assert env.email_host == settings.EMAIL_HOST
        assert env.email_port == settings.EMAIL_PORT
        assert settings.EMAIL_USE_TLS is env.email_use_tls
        assert env.email_host_user == settings.EMAIL_HOST_USER
        assert env.default_from_email == settings.DEFAULT_FROM_EMAIL
        assert settings.EMAIL_TIMEOUT == 10
        assert not settings.FRONTEND_BASE_URL.endswith("/")


class TestMailChecks:
    def _run(self, **overrides):
        base = {
            "EMAIL_BACKEND": SMTP,
            "EMAIL_USE_TLS": True,
            "EMAIL_USE_SSL": False,
            "FRONTEND_BASE_URL": "https://studio.example.com",
            "DEFAULT_FROM_EMAIL": "noreply@studio.example.com",
        }
        base.update(overrides)
        with override_settings(**base):
            return checks.mail_is_sent_over_tls(None)

    def test_a_correct_setup_is_clean(self):
        assert self._run() == []

    def test_implicit_tls_is_accepted_too(self):
        assert self._run(EMAIL_USE_TLS=False, EMAIL_USE_SSL=True) == []

    def test_smtp_without_tls_is_an_error(self):
        assert _ids(self._run(EMAIL_USE_TLS=False)) == ["core.E003"]

    def test_both_tls_modes_at_once_is_an_error(self):
        assert _ids(self._run(EMAIL_USE_SSL=True)) == ["core.E003"]

    def test_another_backend_is_not_judged_on_tls(self):
        backend = "django.core.mail.backends.console.EmailBackend"
        assert self._run(EMAIL_BACKEND=backend, EMAIL_USE_TLS=False) == []

    @pytest.mark.parametrize("url", ["", "http://studio.example.com", "studio.example.com"])
    def test_the_reset_link_needs_an_https_base_address(self, url):
        assert _ids(self._run(FRONTEND_BASE_URL=url)) == ["core.E004"]

    def test_the_development_sender_is_a_warning(self):
        assert _ids(self._run(DEFAULT_FROM_EMAIL="noreply@studiohub.local")) == ["core.W003"]


class TestProxyCheck:
    def test_an_empty_trusted_proxy_list_is_a_warning(self):
        with override_settings(TRUSTED_PROXY_IPS=()):
            assert _ids(checks.client_address_comes_from_the_proxy(None)) == ["core.W004"]

    def test_a_configured_list_is_clean(self):
        with override_settings(TRUSTED_PROXY_IPS=("172.31.250.0/24",)):
            assert checks.client_address_comes_from_the_proxy(None) == []


@pytest.mark.django_db
class TestResetLink:
    def test_the_reset_email_links_to_the_web_client(self):
        user = UserFactory.create(is_active=True)

        with override_settings(FRONTEND_BASE_URL="https://studio.example.com"):
            token = PasswordResetService.request_reset(email=user.email)

        body = mail.outbox[-1].body
        assert f"https://studio.example.com/reset-password?token={token}" in body
