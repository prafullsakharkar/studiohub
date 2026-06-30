from rest_framework import serializers

from .mixins import (
    AuditSerializerMixin,
    DynamicFieldsMixin,
    ErrorMessageMixin,
    MetadataSerializerMixin,
    SerializerContextMixin,
    ValidationMixin,
)


class BaseSerializer(
    DynamicFieldsMixin,
    MetadataSerializerMixin,
    AuditSerializerMixin,
    ValidationMixin,
    SerializerContextMixin,
    ErrorMessageMixin,
    serializers.ModelSerializer,
):
    """
    Base serializer for all application serializers.
    """

    class Meta:
        abstract = True
