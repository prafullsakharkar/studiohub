from rest_framework import serializers

from apps.identity.models import UserSession


class UserSessionUpdateSerializer(
    serializers.ModelSerializer,
):

    class Meta:

        model = UserSession

        fields = ("is_trusted",)
