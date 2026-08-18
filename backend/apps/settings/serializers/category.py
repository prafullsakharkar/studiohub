"""
Setting Category serializer.
"""
from rest_framework import serializers

from apps.settings.models.category import SettingCategory


class SettingCategorySerializer(serializers.ModelSerializer):
    """
    Serializer for SettingCategory.
    """
    
    class Meta:
        model = SettingCategory
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "icon",
            "order",
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
