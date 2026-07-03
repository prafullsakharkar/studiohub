from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.api.exceptions import (
    InvalidCredentials,
    UserInactive,
)


class AuthenticationService:

    @classmethod
    def login(
        cls,
        *,
        email: str,
        password: str,
    ):
        user = authenticate(
            username=email,
            password=password,
        )

        if user is None:
            raise InvalidCredentials()

        if not user.is_active:
            raise UserInactive()

        refresh = RefreshToken.for_user(user)

        return {
            "user": user,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }

    @classmethod
    def refresh(
        cls,
        *,
        refresh_token: str,
    ):
        refresh = RefreshToken(refresh_token)

        return {
            "access": str(refresh.access_token),
        }
