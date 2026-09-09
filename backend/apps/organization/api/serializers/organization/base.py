"""
Organization serializer base classes.
"""

from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.organization.models import Organization


class OrganizationSerializer(BaseReadSerializer[Any]):
    """
    Base read serializer for Organization.

    ``uuid`` is a property alias for the ``id`` primary key, so it is
    declared explicitly here to make it available in every read variant.
    """

    uuid = serializers.UUIDField(
        source="id",
        read_only=True,
    )

    # Frontend Organization contract fields (types/organization.ts).
    # Read-only derivations so list/summary/detail all satisfy the
    # switcher + overview tabs; empty/zero fallbacks never crash `.split`.
    tier = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    crew_count = serializers.SerializerMethodField()
    offices_count = serializers.SerializerMethodField()
    active_projects_count = serializers.SerializerMethodField()
    storage_quota_tb = serializers.SerializerMethodField()
    storage_used_tb = serializers.SerializerMethodField()
    primary_contact_email = serializers.CharField(source="email", read_only=True)

    class Meta:
        model = Organization
        fields = "__all__"

    def get_tier(self, obj) -> str:
        billing = getattr(obj, "billing", None)
        return getattr(billing, "tier", "") or ""

    def get_logo_url(self, obj) -> str:
        logo = getattr(obj, "logo", None)
        if not logo:
            return ""
        try:
            return logo.url or ""
        except (ValueError, AttributeError):
            return ""

    def get_crew_count(self, obj) -> int:
        stats = obj.statistics
        if stats["member_count"]:
            return stats["member_count"]
        return obj.memberships.count()

    def get_offices_count(self, obj) -> int:
        stats = obj.statistics
        if stats["office_count"]:
            return stats["office_count"]
        return obj.organization_offices.count()

    def get_active_projects_count(self, obj) -> int:
        return obj.production_projects.exclude(status="Archived").count()

    def get_storage_quota_tb(self, obj):
        billing = getattr(obj, "billing", None)
        return getattr(billing, "storage_quota_tb", 0) or 0

    def get_storage_used_tb(self, obj):
        billing = getattr(obj, "billing", None)
        return getattr(billing, "storage_used_tb", 0) or 0
