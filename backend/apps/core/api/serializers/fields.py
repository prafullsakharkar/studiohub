"""
Reusable serializer fields.
"""

from __future__ import annotations

from rest_framework import serializers


class LowercaseEmailField(serializers.EmailField):
    """
    Always returns lowercase email.
    """

    def to_internal_value(self, data):
        return super().to_internal_value(data).lower()


class UppercaseCharField(serializers.CharField):
    """
    Convert value to uppercase.
    """

    def to_internal_value(self, data):
        return super().to_internal_value(data).upper()


class TrimmedCharField(serializers.CharField):
    """
    Trim whitespace.
    """

    def to_internal_value(self, data):
        return super().to_internal_value(data.strip())


class ChoiceDisplayField(serializers.Field):
    """
    Serialize a model choice display value.
    """

    def __init__(self, method_name: str, **kwargs):
        self.method_name = method_name
        super().__init__(read_only=True, **kwargs)

    def to_representation(self, obj):
        return getattr(obj, self.method_name)()
