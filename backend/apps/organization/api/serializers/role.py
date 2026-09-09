from typing import Any

from django.utils.text import slugify
from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import Role


class RoleBaseSerializer(OrganizationEntitySerializer[Role]):
    """
    Base serializer for Role.

    ``permissions`` accepts frontend permission-code lists (write-only);
    reads expose granted codes so the Roles UI round-trips.
    """

    permissions = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
    )

    class Meta(OrganizationEntitySerializer.Meta):
        model = Role

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "code",
            "name",
            "description",
            "role_type",
            "scope",
            "priority",
            "parent",
            "icon",
            "color",
            "is_system",
            "is_default",
            "is_active",
            "sort_order",
        )

        read_only_fields = (
            *OrganizationEntitySerializer.Meta.read_only_fields,
        )


class RoleCreateSerializer(RoleBaseSerializer):
    """
    Serializer for creating Role.

    ``code`` is writable here (auto-slugified from ``name`` when absent);
    ``organization`` resolves from the request org context. ``permissions``
    carries frontend code lists for post-create sync (popped before the
    model layer — see ``RoleService.create``).
    """

    class Meta(RoleBaseSerializer.Meta):
        read_only_fields = (
            *(
                f
                for f in RoleBaseSerializer.Meta.read_only_fields
                if f != "code"
            ),
            "organization",
        )
        extra_kwargs = {
            "code": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        attrs = super().validate(attrs)
        name = attrs.get("name", "")
        code = (attrs.get("code") or "").strip()
        if not code and name:
            base = slugify(name)[:90] or "role"
            code, counter = base, 2
            while Role.objects.filter(code=code).exists():
                suffix = f"-{counter}"
                code = f"{base[:90 - len(suffix)]}{suffix}"
                counter += 1
        if code:
            attrs["code"] = code
        request = self.context.get("request")
        org = getattr(request, "organization", None)
        if org is not None:
            attrs["organization"] = org
        return attrs


class RoleUpdateSerializer(RoleBaseSerializer):
    """
    Serializer for updating Role.
    """

    class Meta(RoleBaseSerializer.Meta):
        read_only_fields = (
            *RoleBaseSerializer.Meta.read_only_fields,
            "code",
        )


class RoleListSerializer(RoleBaseSerializer):
    """
    Serializer for listing Role.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    permission_count = serializers.IntegerField(read_only=True)
    user_count = serializers.IntegerField(read_only=True)
    group_count = serializers.IntegerField(read_only=True)

    class Meta(RoleBaseSerializer.Meta):
        fields = (
            *RoleBaseSerializer.Meta.fields,
            "organization_name",
            "parent_name",
            "permission_count",
            "user_count",
            "group_count",
        )


class RoleDetailSerializer(RoleBaseSerializer):
    """
    Serializer for retrieving Role details.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    permissions = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    users = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    groups = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta(RoleBaseSerializer.Meta):
        fields = (
            *RoleBaseSerializer.Meta.fields,
            "organization_name",
            "parent_name",
            "permissions",
            "users",
            "groups",
        )


class RoleAssignSerializer(serializers.Serializer[Any]):
    """
    Serializer for assigning Role to users.
    """

    user = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class RolePermissionSerializer(serializers.Serializer[Any]):
    """
    Serializer for Role permission operations.
    """

    permission = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    granted = serializers.BooleanField(default=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
