"""
Tag API serializers.
"""

import re

from rest_framework import serializers

from apps.core.models.tag import Tag

HEX_COLOR = re.compile(r"^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$")


class TagSerializer(serializers.ModelSerializer[Tag]):
    """
    Base serializer for Tag.
    """

    class Meta:
        model = Tag
        fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "name",
            "description",
            "color",
            "is_system",
            "created_by",
            "updated_by",
            "deleted_by",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_by",
        )


class TagWriteSerializer(TagSerializer):
    """Checks shared by the create and update bodies."""

    def validate_color(self, value):
        if value and not HEX_COLOR.match(value):
            raise serializers.ValidationError("Enter a hex colour such as #3366ff.")
        return value

    def validate(self, attrs):
        # Whether a tag is a system tag is for a platform administrator to say; anyone else's value is ignored.
        request = self.context.get("request")
        if not getattr(getattr(request, "user", None), "is_superuser", False):
            attrs.pop("is_system", None)
        return super().validate(attrs)


class TagListSerializer(TagSerializer):
    """
    Serializer for Tag list.
    """

    class Meta(TagSerializer.Meta):
        pass


class TagDetailSerializer(TagSerializer):
    """
    Serializer for Tag detail.
    """

    class Meta(TagSerializer.Meta):
        pass


class TagCreateSerializer(TagWriteSerializer):
    """
    Serializer for Tag creation.
    """

    class Meta(TagSerializer.Meta):
        fields = tuple(
            f
            for f in TagSerializer.Meta.fields
            if f
            not in (
                "created_at",
                "updated_at",
                "created_by",
                "updated_by",
                "deleted_by",
            )
        )


class TagUpdateSerializer(TagWriteSerializer):
    """
    Serializer for Tag update.
    """

    class Meta(TagSerializer.Meta):
        fields = (
            "id",
            "uuid",
            "name",
            "description",
            "color",
            "is_system",
        )
