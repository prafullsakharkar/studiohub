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


class BaseReadSerializer(BaseModelSerializer):
    """
    Read-only serializer.

    Used for GET endpoints.
    """

    class Meta:
        abstract = True


class BaseWriteSerializer(BaseModelSerializer):
    """
    Write serializer.

    Validation only.

    Persistence is delegated to the service layer.
    """

    class Meta:
        abstract = True

    def create(self, validated_data):
        raise NotImplementedError(
            "Serializer.create() is disabled. " "Use the service layer instead."
        )

    def update(self, instance, validated_data):
        raise NotImplementedError(
            "Serializer.update() is disabled. " "Use the service layer instead."
        )


class BaseNestedSerializer(BaseReadSerializer):
    """
    Lightweight serializer intended for nested relationships.

    Applications should override Meta.fields with the minimal
    representation required by the parent serializer.
    """

    class Meta:
        abstract = True
