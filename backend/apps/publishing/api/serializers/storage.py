"""Serializer for storage roots; writes go through ``StorageRootService``."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.publishing.models import StorageRoot
from apps.publishing.services.storage import StorageRootService


class StorageRootSerializer(serializers.ModelSerializer[StorageRoot]):
    class Meta:
        model = StorageRoot
        fields = (
            "id",
            "code",
            "name",
            "linux_path",
            "windows_path",
            "mac_path",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        # The code rules (any-case uniqueness, immutability) live in the service.
        extra_kwargs = {"code": {"validators": []}}

    def create(self, validated_data: dict[str, Any]) -> StorageRoot:
        return StorageRootService.create(actor=self.context["request"].user, data=validated_data)

    def update(self, instance: StorageRoot, validated_data: dict[str, Any]) -> StorageRoot:
        return StorageRootService.update(
            actor=self.context["request"].user, root=instance, data=validated_data
        )
