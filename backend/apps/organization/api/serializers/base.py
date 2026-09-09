from typing import TypeVar

from django.db import models
from rest_framework import serializers

_ModelT = TypeVar("_ModelT", bound=models.Model)


class OrganizationEntitySerializer(serializers.ModelSerializer[_ModelT]):
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
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
