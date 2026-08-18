"""
System Setting serializer.
"""
from rest_framework import serializers

from apps.settings.models.system import SystemSetting


class SystemSettingSerializer(serializers.ModelSerializer):
    """
    Serializer for SystemSetting.
    """

    setting_code = serializers.CharField(source="setting.code", read_only=True)
    setting_name = serializers.CharField(source="setting.name", read_only=True)
    setting_data_type = serializers.CharField(source="setting.data_type", read_only=True)
    setting_default_value = serializers.CharField(source="setting.default_value", read_only=True)
    
    class Meta:
        model = SystemSetting
        fields = (
            "id",
            "uuid",
            "setting",
            "setting_code",
            "setting_name",
            "setting_data_type",
            "setting_default_value",
            "value",
            "is_locked",
            "locked_by",
            "locked_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "is_locked",
            "locked_by",
            "locked_at",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        """
        Enforce the lock and validate the value against the definition.
        """
        instance = getattr(self, "instance", None)

        if instance is not None and instance.is_locked:
            raise serializers.ValidationError(
                {"value": "This setting is locked and cannot be changed."}
            )

        if "value" in attrs:
            setting = instance.setting if instance else attrs.get("setting")

            if setting is not None:
                import json

                try:
                    parsed = json.loads(attrs["value"])
                except (json.JSONDecodeError, TypeError):
                    parsed = attrs["value"]

                valid, errors = setting.validate_value(parsed)

                if not valid:
                    raise serializers.ValidationError(
                        {"value": errors}
                    )

        return attrs
