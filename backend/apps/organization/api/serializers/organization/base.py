"""
Organization serializer base classes.
"""

from apps.core.api.serializers.base import BaseReadSerializer
from apps.organization.models import Organization


class OrganizationSerializer(BaseReadSerializer):

    class Meta:
        model = Organization
        fields = "__all__"
