"""
Theme serializer.
"""
import re

from rest_framework import serializers

from apps.settings.models.theme import Theme

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
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
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
