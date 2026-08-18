"""
Theme serializer.
"""
from rest_framework import serializers

from apps.settings.models.theme import Theme


class ThemeSerializer(serializers.ModelSerializer):
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
            "organization",
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
