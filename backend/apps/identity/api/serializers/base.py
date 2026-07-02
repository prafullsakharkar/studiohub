from rest_framework import serializers


class IdentitySerializer(serializers.ModelSerializer):
    """
    Base serializer for Identity models.
    """

    class Meta:
        abstract = True

        fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
