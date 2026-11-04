"""
Directory (LDAP) sign-in records (ADR-0039).

``DirectoryConfiguration`` is the one row an administrator edits from Settings -> System ->
Directory (LDAP). ``ExternalIdentity`` ties an account to the directory entry it was made from.
Both are platform-global (ADR-0034).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

DEFAULT_USER_FILTER = "(&(objectClass=inetOrgPerson)(uid={username}))"


class DirectoryConfiguration(models.Model):
    """
    The directory connection, edited from the settings screen (one row, ``pk`` 1).

    ``bind_password`` holds ciphertext only (``apps.identity.services.directory.secret``); it is
    write-only through the API.
    """

    SINGLETON_PK = 1

    enabled = models.BooleanField(default=False)

    server_uri = models.CharField(max_length=512, blank=True, default="")

    start_tls = models.BooleanField(default=False)

    ca_certificate = models.TextField(blank=True, default="")

    bind_dn = models.CharField(max_length=512, blank=True, default="")

    bind_password = models.TextField(blank=True, default="")

    user_search_base = models.CharField(max_length=512, blank=True, default="")

    user_filter = models.CharField(max_length=512, default=DEFAULT_USER_FILTER)

    attr_subject = models.CharField(max_length=64, default="entryUUID")

    attr_username = models.CharField(max_length=64, default="uid")

    attr_email = models.CharField(max_length=64, default="mail")

    attr_first_name = models.CharField(max_length=64, default="givenName")

    attr_last_name = models.CharField(max_length=64, default="sn")

    attr_display_name = models.CharField(max_length=64, default="displayName")

    timeout_seconds = models.PositiveSmallIntegerField(default=5)

    default_role_code = models.CharField(max_length=100, default="artist")

    require_mfa = models.BooleanField(default=False)

    # When the saved settings last passed a connection test (enabling needs one).
    last_tested_at = models.DateTimeField(blank=True, null=True)

    updated_at = models.DateTimeField(auto_now=True)

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="+",
    )

    class Meta:
        db_table = "identity_directory_configuration"

    def __str__(self) -> str:
        return f"Directory ({'on' if self.enabled else 'off'})"


class ExternalIdentityProvider(models.TextChoices):
    LDAP = "ldap", "LDAP"


class ExternalIdentity(models.Model):
    """An account's link to the directory entry it signs in with."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="external_identities",
    )

    provider = models.CharField(
        max_length=20,
        choices=ExternalIdentityProvider.choices,
        default=ExternalIdentityProvider.LDAP,
    )

    # The entry's stable id (entryUUID): unchanged when the entry is renamed or moved.
    subject = models.CharField(max_length=255)

    # What the person types (uid); unique per provider whatever its case.
    username = models.CharField(max_length=255)

    dn = models.CharField(max_length=1024, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    last_synced_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "identity_external_identities"
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "subject"],
                name="uniq_identity_external_subject",
            ),
            models.UniqueConstraint(
                "provider",
                Lower("username"),
                name="uniq_identity_external_username_lower",
            ),
            models.UniqueConstraint(
                fields=["provider", "user"],
                name="uniq_identity_external_user",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.provider}:{self.username}"
