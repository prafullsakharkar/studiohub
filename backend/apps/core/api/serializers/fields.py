"""
Reusable serializer fields.
"""

from __future__ import annotations

from typing import Any

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


class CaseInsensitiveChoiceField(serializers.ChoiceField):
    """
    ChoiceField accepting frontend Title Case values for lowercase DB choices.

    The frontend contract sends statuses like ``Active`` / ``In Progress``
    while models store lowercase choices (``active``). Exact matches pass
    through; otherwise the first case-insensitive match wins; anything else
    raises the standard invalid-choice error (fail closed).
    """

    def to_internal_value(self, data):
        if isinstance(data, str):
            lowered = data.strip().lower()
            for key, _display in self.choices.items():
                if str(key).lower() == lowered:
                    return key
        return super().to_internal_value(data)


class ChoiceDisplayField(serializers.Field[Any, Any, Any, Any]):
    """
    Serialize a model choice display value.
    """

    def __init__(self, method_name: str, **kwargs):
        self.method_name = method_name
        super().__init__(read_only=True, **kwargs)

    def to_representation(self, value):
        return getattr(value, self.method_name)()
