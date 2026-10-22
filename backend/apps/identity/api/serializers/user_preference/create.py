
from rest_framework import serializers

from apps.identity.models import User
from apps.identity.services.profile import ProfileService
from apps.identity.services.security_event import SecurityEventService

from .base import (
    ProfileBaseSerializer,
    SecurityEventBaseSerializer,
)


class ProfileCreateSerializer(
    ProfileBaseSerializer,
):
    """
    Create a profile for the authenticated user.

    ``user`` is read-only (inherited from ``ProfileBaseSerializer.Meta``):
    clients can never create a profile for another account. The viewset injects
    ``request.user``. The model also enforces OneToOne uniqueness.
    """

    class Meta(
        ProfileBaseSerializer.Meta,
    ):
        pass

    def get_unique_together_validators(self):
        """
        Drop unique-together validators that reference ``user``.

        ``user`` is injected server-side by the viewset after validation, so a
        validator requiring it would reject every create request. Uniqueness is
        still enforced at the DB layer.
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
        # DRF merges ``save(user=...)`` kwargs into validated_data; pop the
        # owner so it is passed exactly once. Read-only ``user`` is never
        # accepted from request bodies.
        owner = validated_data.pop("user", None)

        return ProfileService.create(
            user=owner,
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
