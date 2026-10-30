"""
Setting Definition serializer.
"""
from rest_framework import serializers

from apps.settings.models.definition import SettingDefinition

SELECT_TYPES = (SettingDefinition.TYPE_SELECT, SettingDefinition.TYPE_MULTIPLE_SELECT)


class SettingDefinitionSerializer(serializers.ModelSerializer[SettingDefinition]):
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

    def validate_choices(self, value):
        """Choices are objects with a ``value`` and a ``label``; the value validator reads ``c["value"]``."""
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Choices must be a list of {"value", "label"} objects.')
        seen = set()
        for index, choice in enumerate(value, start=1):
            if not isinstance(choice, dict) or not str(choice.get("value", "")).strip():
                raise serializers.ValidationError(
                    f'Choice {index} must be an object with a "value" and a "label", not {choice!r}.'
                )
            if not str(choice.get("label", "")).strip():
                raise serializers.ValidationError(f'Choice {index} needs a "label".')
            key = str(choice["value"])
            if key in seen:
                raise serializers.ValidationError(f'The value "{key}" appears twice.')
            seen.add(key)
        return value

    def validate(self, attrs):
        data_type = attrs.get("data_type", getattr(self.instance, "data_type", None))
        choices = attrs["choices"] if "choices" in attrs else getattr(self.instance, "choices", None)
        if data_type in SELECT_TYPES and not choices:
            raise serializers.ValidationError({"choices": ["A select setting needs at least one choice."]})
        return attrs
