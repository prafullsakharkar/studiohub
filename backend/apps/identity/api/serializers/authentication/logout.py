from rest_framework import serializers

from apps.identity.services.authentication import (
    AuthenticationService,
)


class LogoutSerializer(
    serializers.Serializer,
):
    refresh = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    def save(
        self,
        **kwargs,
    ):
        request = self.context["request"]

        AuthenticationService.logout(
            request=request,
            session=request.user.current_session,
            refresh_token=self.validated_data.get(
                "refresh",
            ),
        )

        return {}
