from rest_framework import serializers

from apps.identity.api.serializers.base import IdentitySerializer
from apps.identity.models import OrganizationMembership


class MembershipBaseSerializer(IdentitySerializer):

    class Meta(IdentitySerializer.Meta):

        model = OrganizationMembership

        fields = (
            *IdentitySerializer.Meta.fields,
            "employee_id",
            "employment_type",
            "status",
            "joined_at",
            "left_at",
            "is_primary",
        )
