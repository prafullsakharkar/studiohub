"""
Serializer utility helpers.
"""


class SerializerUtils:
    @staticmethod
    def update_fields(instance, validated_data):
        """
        Update instance attributes from validated data.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)

        return instance

    @staticmethod
    def writable_fields(serializer):
        return [field.field_name for field in serializer._writable_fields]

    @staticmethod
    def readable_fields(serializer):
        return [field.field_name for field in serializer._readable_fields]
