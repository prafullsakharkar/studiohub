"""
Base serializer for Settings entities.
"""

from rest_framework import serializers


class SettingsBaseSerializer(serializers.ModelSerializer):
    """
    Base serializer for Settings entities.
    """

    class Meta:
        abstract = True
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "icon",
            "primary_color",
            "secondary_color",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
