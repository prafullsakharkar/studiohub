"""
Organization serializer base classes.
"""

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.organization.models import Organization


class OrganizationSerializer(BaseReadSerializer):
    """
    Base read serializer for Organization.

    ``uuid`` is a property alias for the ``id`` primary key, so it is
    declared explicitly here to make it available in every read variant.
    """

    uuid = serializers.UUIDField(
        source="id",
        read_only=True,
    )

    class Meta:
        model = Organization
        fields = "__all__"
