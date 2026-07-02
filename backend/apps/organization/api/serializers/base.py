from rest_framework import serializers


class OrganizationEntitySerializer(serializers.ModelSerializer):
    """
    Base serializer for Organization entities.

    Used by:

        - Department
        - Team
        - Office
    """

    class Meta:
        abstract = True

        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "organization",
            "status",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
