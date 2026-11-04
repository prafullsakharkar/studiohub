"""The directory (LDAP) settings screen (ADR-0039 decision 3)."""

from __future__ import annotations

from typing import Any

from django.conf import settings
from rest_framework import serializers

from apps.identity.models import DirectoryConfiguration


class DirectoryConfigurationSerializer(serializers.ModelSerializer[DirectoryConfiguration]):
    """
    The configuration as the screen shows it. The service password is write-only: a read says
    only whether one is set.
    """

    bind_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        style={"input_type": "password"},
        help_text="A new value sets it; an empty string clears it; leave it out to keep it.",
    )

    bind_password_set = serializers.SerializerMethodField()

    forced_off = serializers.SerializerMethodField()

    encryption_key_set = serializers.SerializerMethodField()

    class Meta:
        model = DirectoryConfiguration
        fields = (
            "enabled",
            "server_uri",
            "start_tls",
            "ca_certificate",
            "bind_dn",
            "bind_password",
            "bind_password_set",
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
            "last_tested_at",
            "forced_off",
            "encryption_key_set",
            "updated_at",
        )
        read_only_fields = ("last_tested_at", "updated_at")
        extra_kwargs: dict[str, Any] = {
            "server_uri": {"required": False, "allow_blank": True},
            "bind_dn": {"required": False, "allow_blank": True},
            "user_search_base": {"required": False, "allow_blank": True},
            "ca_certificate": {"required": False, "allow_blank": True, "trim_whitespace": False},
        }

    def get_bind_password_set(self, obj: DirectoryConfiguration) -> bool:
        return bool(obj.bind_password)

    def get_forced_off(self, obj: DirectoryConfiguration) -> bool:
        return bool(getattr(settings, "DIRECTORY_LOGIN_FORCE_OFF", False))

    def get_encryption_key_set(self, obj: DirectoryConfiguration) -> bool:
        return bool(getattr(settings, "DIRECTORY_ENCRYPTION_KEYS", ()))


class DirectoryTestUserSerializer(serializers.Serializer[Any]):
    username = serializers.CharField(max_length=255)
