"""
Mail transport and client-address settings (TPN review TM-017, TM-014).

Mail settings used to be read from the environment and dropped, so production fell back to Django's
local relay without TLS. The deploy checks refuse the unsafe combinations.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from django.core import mail
from django.core.mail.backends.smtp import EmailBackend as SmtpBackend
from django.test import override_settings
from pydantic import SecretStr

from apps.core import checks
from apps.identity.services.password_reset import PasswordResetService
from apps.identity.tests.factories import UserFactory
from config.settings.components.email import build_mailers

SMTP = "django.core.mail.backends.smtp.EmailBackend"


def _ids(findings):
    return sorted(f.id for f in findings)


class TestEnvironmentReachesDjango:
    def test_the_mail_settings_exist_and_follow_the_environment_loader(self):
        from django.conf import settings

        from config.env import settings as env

        options = build_mailers(env)["default"]["OPTIONS"]

        assert options["host"] == env.email_host
        assert options["port"] == env.email_port
        assert options["use_tls"] is env.email_use_tls
        assert options["use_ssl"] is env.email_use_ssl
        assert options["timeout"] == 10
        assert env.default_from_email == settings.DEFAULT_FROM_EMAIL
        assert not settings.FRONTEND_BASE_URL.endswith("/")
        # The deprecated EMAIL_* settings must not come back: Django 6.1 refuses them next to MAILERS.
        assert not any(
            hasattr(settings, name) for name in ("EMAIL_HOST", "EMAIL_PORT", "EMAIL_USE_TLS")
        )


def _env(**values: object):
    base: dict[str, object] = {
        "email_host": "mail.example.net",
        "email_port": 587,
        "email_use_tls": True,
        "email_use_ssl": False,
        "email_host_user": "",
        "email_host_password": SecretStr(""),
        "email_backend": SMTP,
    }
    base.update(values)
    return SimpleNamespace(**base)


class TestMailersFromTheEnvironment:
    def test_every_value_reaches_the_mailer(self):
        env = _env(
            email_host_user="mailer",
            email_host_password=SecretStr("s3cret"),
            email_port=465,
            email_use_tls=False,
            email_use_ssl=True,
        )

        assert build_mailers(env) == {
            "default": {
                "BACKEND": SMTP,
                "OPTIONS": {
                    "host": "mail.example.net",
                    "port": 465,
                    "use_tls": False,
                    "use_ssl": True,
                    "timeout": 10,
                    "username": "mailer",
                    "password": "s3cret",
                },
            }
        }

    def test_blank_credentials_are_left_out(self):
        options = build_mailers(_env())["default"]["OPTIONS"]

        assert "username" not in options
        assert "password" not in options

    def test_django_builds_an_smtp_connection_from_it(self):
        env = _env(email_host_user="mailer", email_host_password=SecretStr("s3cret"))

        with override_settings(MAILERS=build_mailers(env)):
            connection = mail.mailers["default"]

        assert isinstance(connection, SmtpBackend)
        assert (connection.host, connection.port, connection.use_tls, connection.use_ssl) == (
            "mail.example.net",
            587,
            True,
            False,
        )
        assert (connection.username, connection.password, connection.timeout) == (
            "mailer",
            "s3cret",
            10,
        )


class TestMailChecks:
    def _run(
        self,
        *,
        backend: str = SMTP,
        use_tls: bool = True,
        use_ssl: bool = False,
        **overrides: object,
    ):
        base: dict[str, object] = {
            "MAILERS": {
                "default": {
                    "BACKEND": backend,
                    "OPTIONS": {"host": "mail.example.net", "use_tls": use_tls, "use_ssl": use_ssl},
                }
            },
            "FRONTEND_BASE_URL": "https://studio.example.com",
            "DEFAULT_FROM_EMAIL": "noreply@studio.example.com",
        }
        base.update(overrides)
        with override_settings(**base):
            return checks.mail_is_sent_over_tls(None)

    def test_a_correct_setup_is_clean(self):
        assert self._run() == []

    def test_implicit_tls_is_accepted_too(self):
        assert self._run(use_tls=False, use_ssl=True) == []

    def test_smtp_without_tls_is_an_error(self):
        assert _ids(self._run(use_tls=False)) == ["core.E003"]

    def test_both_tls_modes_at_once_is_an_error(self):
        assert _ids(self._run(use_ssl=True)) == ["core.E003"]

    def test_another_backend_is_not_judged_on_tls(self):
        backend = "django.core.mail.backends.console.EmailBackend"
        assert self._run(backend=backend, use_tls=False) == []

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
