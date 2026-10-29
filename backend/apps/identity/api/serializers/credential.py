from __future__ import annotations

from typing import Any

from rest_framework import serializers


class CredentialSerializer(serializers.Serializer[Any]):
    """
    Read shape for an API key or PAT. Carries no digest and no secret; the
    secret is added once, by the create/rotate response only.
    """

    id = serializers.UUIDField(read_only=True)
    kind = serializers.SerializerMethodField()
    name = serializers.CharField(read_only=True)
    description = serializers.SerializerMethodField()
    prefix = serializers.CharField(read_only=True)
    scopes = serializers.ListField(child=serializers.CharField(), read_only=True)
    unrestricted = serializers.SerializerMethodField()
    expires_at = serializers.DateTimeField(read_only=True)
    last_used_at = serializers.DateTimeField(read_only=True)
    last_used_ip = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    revoked_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_kind(self, obj) -> str:
        return self.context["kind"].key

    def get_description(self, obj) -> str:
        return getattr(obj, "description", "")

    def get_unrestricted(self, obj) -> bool:
        # Legacy credentials with no scopes act with their owner's full access.
        return not obj.scopes


class CredentialCreateSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(
        max_length=1000, required=False, allow_blank=True, default=""
    )
    scopes = serializers.ListField(
        child=serializers.CharField(max_length=100),
        allow_empty=False,
        max_length=50,
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True, default=None)
