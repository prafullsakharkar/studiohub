from rest_framework import serializers

from apps.identity.models import UserSession
from apps.identity.services.user_session import (
    UserSessionService,
)


class UserSessionCreateSerializer(
    serializers.ModelSerializer,
):

    class Meta:

        model = UserSession

        exclude = ()

    def create(self, validated_data):

        return UserSessionService.create(
            **validated_data,
        )
