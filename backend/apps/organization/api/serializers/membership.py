from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import OrganizationMembership


class OrganizationMembershipBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for OrganizationMembership.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = OrganizationMembership

        fields = (
            "id",
            "uuid",
            "user",
            "organization",
            "department",
            "team",
            "office",
            "role",
            "employee_id",
            "employment_type",
            "status",
            "joined_at",
            "left_at",
            "is_primary",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )


class OrganizationMembershipCreateSerializer(OrganizationMembershipBaseSerializer):
    """
    Serializer for creating OrganizationMembership.
    """

    class Meta(OrganizationMembershipBaseSerializer.Meta):
        read_only_fields = (
            *OrganizationMembershipBaseSerializer.Meta.read_only_fields,
            "organization",
        )


class OrganizationMembershipUpdateSerializer(OrganizationMembershipBaseSerializer):
    """
    Serializer for updating OrganizationMembership.
    """

    class Meta(OrganizationMembershipBaseSerializer.Meta):
        read_only_fields = (
            *OrganizationMembershipBaseSerializer.Meta.read_only_fields,
            "user",
            "organization",
        )


class OrganizationMembershipListSerializer(OrganizationMembershipBaseSerializer):
    """
    Serializer for listing OrganizationMembership.
    """

    user_name = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)
    office_name = serializers.CharField(source="office.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta(OrganizationMembershipBaseSerializer.Meta):
        fields = (
            *OrganizationMembershipBaseSerializer.Meta.fields,
            "user_name",
            "user_email",
            "organization_name",
            "department_name",
            "team_name",
            "office_name",
            "role_name",
        )


class OrganizationMembershipDetailSerializer(OrganizationMembershipBaseSerializer):
    """
    Serializer for retrieving OrganizationMembership details.
    """

    user_name = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)
    office_name = serializers.CharField(source="office.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta(OrganizationMembershipBaseSerializer.Meta):
        fields = (
            *OrganizationMembershipBaseSerializer.Meta.fields,
            "user_name",
            "user_email",
            "organization_name",
            "department_name",
            "team_name",
            "office_name",
            "role_name",
        )
