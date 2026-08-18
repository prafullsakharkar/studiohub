from rest_framework import serializers

from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models import Invitation


class InvitationBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for Invitation.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = Invitation

        fields = (
            "id",
            "uuid",
            "organization",
            "email",
            "role",
            "department",
            "team",
            "status",
            "invited_by",
            "accepted_by",
            "expires_at",
            "accepted_at",
            "declined_at",
            "cancelled_at",
            "resent_at",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )


class InvitationCreateSerializer(InvitationBaseSerializer):
    """
    Serializer for creating Invitation.
    """

    class Meta(InvitationBaseSerializer.Meta):
        read_only_fields = (
            *InvitationBaseSerializer.Meta.read_only_fields,
            "organization",
            "status",
            "invited_by",
            "expires_at",
        )


class InvitationUpdateSerializer(InvitationBaseSerializer):
    """
    Serializer for updating Invitation.
    """

    class Meta(InvitationBaseSerializer.Meta):
        read_only_fields = (
            *InvitationBaseSerializer.Meta.read_only_fields,
            "organization",
            "email",
            "invited_by",
        )


class InvitationListSerializer(InvitationBaseSerializer):
    """
    Serializer for listing Invitation.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)
    invited_by_name = serializers.CharField(
        source="invited_by.get_full_name", read_only=True
    )

    class Meta(InvitationBaseSerializer.Meta):
        fields = (
            *InvitationBaseSerializer.Meta.fields,
            "organization_name",
            "role_name",
            "department_name",
            "team_name",
            "invited_by_name",
        )


class InvitationDetailSerializer(InvitationBaseSerializer):
    """
    Serializer for retrieving Invitation details.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)
    invited_by_name = serializers.CharField(
        source="invited_by.get_full_name", read_only=True
    )
    accepted_by_name = serializers.CharField(
        source="accepted_by.get_full_name", read_only=True
    )

    class Meta(InvitationBaseSerializer.Meta):
        fields = (
            *InvitationBaseSerializer.Meta.fields,
            "organization_name",
            "role_name",
            "department_name",
            "team_name",
            "invited_by_name",
            "accepted_by_name",
        )
