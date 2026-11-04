"""
The directory configuration: read, change, test (ADR-0039 decision 3).

The one row is edited from Settings -> System -> Directory (LDAP). Saving refuses a plain
``ldap://`` server without StartTLS; turning directory sign-in on needs a passing connection test
of the settings as saved; the service password is encrypted and never returned. Every change is
recorded as a security event naming the fields, never a value of the password.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.identity.models import DirectoryConfiguration, Role
from apps.identity.services.directory import secret
from apps.identity.services.directory.client import (
    DirectoryAmbiguous,
    DirectoryClient,
    DirectoryUnavailable,
)

#: Fields an administrator may change (the password separately: it is write-only).
EDITABLE_FIELDS = (
    "enabled",
    "server_uri",
    "start_tls",
    "ca_certificate",
    "bind_dn",
    "user_search_base",
    "user_filter",
    "attr_subject",
    "attr_username",
    "attr_email",
    "attr_first_name",
    "attr_last_name",
    "attr_display_name",
    "timeout_seconds",
    "default_role_code",
    "require_mfa",
)

#: Changing any of these means the last connection test no longer describes the saved settings.
CONNECTION_FIELDS = frozenset(
    {"server_uri", "start_tls", "ca_certificate", "bind_dn", "bind_password", "user_search_base"}
)


class DirectoryConfigurationService:
    """Reads and writes the one configuration row."""

    client_class = DirectoryClient

    @classmethod
    def get(cls) -> DirectoryConfiguration:
        config, _ = DirectoryConfiguration.objects.get_or_create(
            pk=DirectoryConfiguration.SINGLETON_PK
        )
        return config

    @classmethod
    def forced_off(cls) -> bool:
        return bool(getattr(settings, "DIRECTORY_LOGIN_FORCE_OFF", False))

    @classmethod
    def active(cls) -> DirectoryConfiguration | None:
        """The configuration when directory sign-in is on (and not forced off), else ``None``."""
        if cls.forced_off():
            return None
        config = DirectoryConfiguration.objects.filter(
            pk=DirectoryConfiguration.SINGLETON_PK, enabled=True
        ).first()
        return config

    @classmethod
    def client(cls, config: DirectoryConfiguration) -> DirectoryClient:
        """A client for ``config``; raises DirectorySecretUnavailable when the key is missing."""
        return cls.client_class(config, bind_password=secret.decrypt(config.bind_password))

    # ------------------------------------------------------------------
    # Changes
    # ------------------------------------------------------------------

    @staticmethod
    def _uses_plain_ldap(config: DirectoryConfiguration) -> bool:
        return config.server_uri.lower().startswith("ldap://") and not config.start_tls

    @classmethod
    def _validate(cls, config: DirectoryConfiguration) -> None:
        errors: dict[str, str] = {}
        uri = config.server_uri.strip().lower()
        if uri and not uri.startswith(("ldap://", "ldaps://")):
            errors["server_uri"] = "Use an ldaps:// or ldap:// address."
        elif cls._uses_plain_ldap(config):
            errors["start_tls"] = (
                "A plain ldap:// server sends passwords in clear: turn on StartTLS or use ldaps://."
            )
        if "{username}" not in config.user_filter:
            errors["user_filter"] = "The filter must contain {username}."
        if not 1 <= int(config.timeout_seconds) <= 60:
            errors["timeout_seconds"] = "Between 1 and 60 seconds."
        if not Role.objects.filter(
            code=config.default_role_code, is_active=True, is_deleted=False
        ).exists():
            errors["default_role_code"] = "No active role has this code."
        if config.enabled:
            missing = [
                name
                for name in ("server_uri", "bind_dn", "user_search_base")
                if not getattr(config, name).strip()
            ]
            for name in missing:
                errors[name] = "Required to turn directory sign-in on."
            if not config.bind_password:
                errors["bind_password"] = "Required to turn directory sign-in on."
            if not missing and config.bind_password and config.last_tested_at is None:
                errors["enabled"] = (
                    "Run a successful connection test first. To change the connection while "
                    "sign-in is on, turn it off, save, test, then turn it on."
                )
        if errors:
            raise ValidationError({name: [message] for name, message in errors.items()})

    @classmethod
    @transaction.atomic
    def update(cls, *, actor, data: dict[str, Any]) -> DirectoryConfiguration:
        """
        Apply ``data`` (any of EDITABLE_FIELDS, plus ``bind_password``: a new value sets it, an
        empty string clears it, absent keeps it).
        """
        config = DirectoryConfiguration.objects.select_for_update().get(pk=cls.get().pk)
        changed: list[str] = []

        for name in EDITABLE_FIELDS:
            if name not in data:
                continue
            value = data[name]
            if isinstance(value, str):
                value = value.strip()
            if getattr(config, name) != value:
                setattr(config, name, value)
                changed.append(name)

        if "bind_password" in data:
            raw = data["bind_password"] or ""
            if raw:
                config.bind_password = secret.encrypt(raw)
                changed.append("bind_password")
            elif config.bind_password:
                config.bind_password = ""
                changed.append("bind_password")

        if CONNECTION_FIELDS & set(changed):
            config.last_tested_at = None

        cls._validate(config)

        if not changed:
            return config

        config.updated_by = actor
        config.save()
        cls._record(actor=actor, description="Directory settings changed.", fields=changed)
        return config

    @classmethod
    def _record(cls, *, actor, description: str, fields: list[str] | None = None, **extra) -> None:
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        metadata: dict[str, Any] = {"area": "directory", **extra}
        if fields is not None:
            metadata["fields"] = sorted(fields)
        SecurityEventService.create(
            user=actor,
            event_type=SecurityEventType.SETTINGS_UPDATED,
            description=description,
            metadata=metadata,
        )

    # ------------------------------------------------------------------
    # Checks
    # ------------------------------------------------------------------

    @classmethod
    def test_connection(cls, *, actor) -> dict[str, Any]:
        """
        Bind with the service account and read the search base, using the saved settings. A pass
        is remembered (it allows turning sign-in on) until a connection setting changes.
        """
        config = cls.get()
        if not config.server_uri or not config.bind_dn or not config.bind_password:
            return {
                "ok": False,
                "detail": "Save the server, the service account and its password first.",
            }
        if cls._uses_plain_ldap(config):
            return {"ok": False, "detail": "A plain ldap:// server needs StartTLS."}
        try:
            cls.client(config).test_connection()
        except DirectoryUnavailable:
            DirectoryConfiguration.objects.filter(pk=config.pk).update(last_tested_at=None)
            return {
                "ok": False,
                "detail": "The directory could not be reached, or the service account was refused.",
            }
        now = timezone.now()
        DirectoryConfiguration.objects.filter(pk=config.pk).update(last_tested_at=now)
        cls._record(actor=actor, description="Directory connection test passed.")
        return {
            "ok": True,
            "detail": "Connected and read the search base.",
            "tested_at": now.isoformat(),
        }

    @classmethod
    def test_user(cls, *, username: str) -> dict[str, Any]:
        """Find ``username`` and show what would be copied; never asks for the user's password."""
        config = cls.get()
        if not config.server_uri or not config.bind_dn or not config.bind_password:
            return {"ok": False, "found": False, "detail": "Save the connection settings first."}
        try:
            entry = cls.client(config).find(username)
        except DirectoryUnavailable:
            return {"ok": False, "found": False, "detail": "The directory could not be reached."}
        except DirectoryAmbiguous:
            return {
                "ok": False,
                "found": False,
                "detail": "More than one entry matches; tighten the filter.",
            }
        if entry is None:
            return {"ok": True, "found": False, "detail": "No entry matches this username."}
        problems = []
        if not entry.email:
            problems.append("The entry has no e-mail, so no account can be made from it.")
        return {"ok": True, "found": True, "entry": entry.public(), "problems": problems}
