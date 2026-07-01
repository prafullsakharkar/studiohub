"""
Base serializers.
"""

from __future__ import annotations

from rest_framework import serializers


class BaseSerializer(serializers.Serializer):
    """
    Base serializer with common behaviour.
    """

    def validate(self, attrs):
        """
        Global validation hook.
        """
        return super().validate(attrs)

    @property
    def request(self):
        """
        Shortcut to the request object.
        """
        return self.context.get("request")

    @property
    def user(self):
        """
        Shortcut to the authenticated user.
        """
        request = self.request
        return getattr(request, "user", None)


class BaseModelSerializer(serializers.ModelSerializer):
    """
    Base model serializer.
    """

    class Meta:
        abstract = True

    def validate(self, attrs):
        return super().validate(attrs)

    @property
    def request(self):
        return self.context.get("request")

    @property
    def user(self):
        request = self.request
        return getattr(request, "user", None)
