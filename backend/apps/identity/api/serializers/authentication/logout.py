from typing import Any

from rest_framework import serializers

from apps.identity.selectors.authentication import (
    AuthenticationSelector,
)
from apps.identity.services.authentication import (
    AuthenticationService,
)


class LogoutSerializer(
    serializers.Serializer[Any],
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

        session = None
        refresh_token = self.validated_data.get(
            "refresh",
        ) or None

        if refresh_token:
            from rest_framework_simplejwt.tokens import RefreshToken

            try:
                jti = RefreshToken(refresh_token)["jti"]
            except Exception:
                jti = None
            if jti:
                session = AuthenticationSelector.get_session_by_refresh_jti(
                    refresh_token_jti=jti,
                )
        elif getattr(request, "auth", None) is not None:
            jti = getattr(
                getattr(request, "auth", None),
                "payload",
                {},
            ).get("jti")
            if jti:
                session = AuthenticationSelector.get_session_by_access_jti(
                    access_token_jti=jti,
                )

        AuthenticationService.logout(
            request=request,
            session=session,
            refresh_token=refresh_token,
        )

        return {}
