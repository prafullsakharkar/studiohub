from rest_framework import serializers

from apps.identity.models import User
from apps.identity.services.profile import ProfileService
from apps.identity.services.security_event import SecurityEventService
from apps.identity.services.trusted_device import TrustedDeviceService

from .base import (
    ProfileBaseSerializer,
    SecurityEventBaseSerializer,
    TrustedDeviceBaseSerializer,
)


class ProfileCreateSerializer(
    ProfileBaseSerializer,
):

    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )

    class Meta(
        ProfileBaseSerializer.Meta,
    ):
        pass

    def get_unique_together_validators(self):
        """
        Drop unique-together validators that reference ``user``.

        ``user`` is injected server-side by the viewset (``perform_create``)
        after validation, so a validator requiring it would reject every
        create request. Uniqueness is still enforced at the DB layer.
        """
        return [
            v
            for v in super().get_unique_together_validators()
            if "user" not in getattr(v, "fields", ())
        ]

    def create(
        self,
        validated_data,
    ):
        return ProfileService.create(
            **validated_data,
        )


class SecurityEventCreateSerializer(
    SecurityEventBaseSerializer,
):

    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )

    class Meta(
        SecurityEventBaseSerializer.Meta,
    ):
        pass

    def get_unique_together_validators(self):
        """
        Drop unique-together validators that reference ``user``.

        ``user`` is injected server-side by the viewset (``perform_create``)
        after validation, so a validator requiring it would reject every
        create request. Uniqueness is still enforced at the DB layer.
        """
        return [
            v
            for v in super().get_unique_together_validators()
            if "user" not in getattr(v, "fields", ())
        ]

    def create(
        self,
        validated_data,
    ):
        return SecurityEventService.create(
            **validated_data,
        )


class TrustedDeviceCreateSerializer(
    TrustedDeviceBaseSerializer,
):

    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )

    class Meta(
        TrustedDeviceBaseSerializer.Meta,
    ):
        pass

    def get_unique_together_validators(self):
        """
        Drop unique-together validators that reference ``user``.

        ``user`` is injected server-side by the viewset (``perform_create``)
        after validation, so a validator requiring it would reject every
        create request. Uniqueness is still enforced at the DB layer.
        """
        return [
            v
            for v in super().get_unique_together_validators()
            if "user" not in getattr(v, "fields", ())
        ]

    def create(
        self,
        validated_data,
    ):
        return TrustedDeviceService.create(
            **validated_data,
        )
