"""
Theme serializer.
"""
import re

from rest_framework import serializers

from apps.settings.models.theme import Theme
from apps.settings.services.default_selection import adopt_if_first

HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
COLOR_FIELDS = (
    "primary_color",
    "secondary_color",
    "accent_color",
    "background_color",
    "surface_color",
    "text_primary",
    "text_secondary",
    "border_color",
)


class ThemeSerializer(serializers.ModelSerializer[Theme]):
    """
    Serializer for Theme.
    """
    
    class Meta:
        model = Theme
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "theme_type",
            "primary_color",
            "secondary_color",
            "accent_color",
            "background_color",
            "surface_color",
            "text_primary",
            "text_secondary",
            "border_color",
            "font_family",
            "font_size",
            "border_radius",
            "spacing_unit",
            "sidebar_collapsed",
            "navbar_fixed",
            "is_active",
            "is_default",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "is_default",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        errors = {
            name: ["Enter a hex colour such as #3B82F6."]
            for name in COLOR_FIELDS
            if name in attrs and not HEX_COLOR.match(str(attrs[name]))
        }
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        # The first active one becomes the default, so there is one whenever there is any to choose from.
        return adopt_if_first(Theme, super().create(validated_data))

    def update(self, instance, validated_data):
        if validated_data.get("is_active") is False and instance.is_default:
            raise serializers.ValidationError(
                {"is_active": ["This is the default and stays active. Make another one the default first."]}
            )
        return super().update(instance, validated_data)
