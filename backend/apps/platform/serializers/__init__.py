"""
Platform serializers.
"""
from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.platform.models import ProductionReport, StudioNotification


class StudioNotificationSerializer(serializers.ModelSerializer[Any]):  # type: ignore[name-defined]
    """Serializer for StudioNotification matching the frontend contract."""

    class Meta:
        model = StudioNotification
        fields = (
            "id",
            "title",
            "message",
            "type",
            "category",
            "read",
            "link",
            "timestamp",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ProductionReportSerializer(serializers.ModelSerializer[Any]):  # type: ignore[name-defined]
    """Serializer for ProductionReport matching the frontend contract."""

    class Meta:
        model = ProductionReport
        fields = (
            "id",
            "title",
            "project_code",
            "category",
            "generated_at",
            "generated_by",
            "status",
            "summary_metrics",
            "download_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
