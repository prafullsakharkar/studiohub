"""
Setting Definition serializer.
"""
from rest_framework import serializers

from apps.settings.models.definition import SettingDefinition


class SettingDefinitionSerializer(serializers.ModelSerializer):
    """
    Serializer for SettingDefinition.
    """
    
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_code = serializers.CharField(source="category.code", read_only=True)
    
    class Meta:
        model = SettingDefinition
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "category",
            "category_name",
            "category_code",
            "data_type",
            "scope",
            "is_required",
            "default_value",
            "help_text",
            "order",
            "is_active",
            "validation_rules",
            "choices",
            "depends_on",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
