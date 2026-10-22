from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()


class IdentityAuthentication(BaseAuthentication):
    """
    Base authentication class for Identity providers.
    """

    keyword: str | None = None

    # ---------------------------------------------------------
    # DRF
    # ---------------------------------------------------------

    def authenticate(
        self,
        request,
    ) -> tuple[User, object] | None:
        token = self.get_token(request)

        if token is None:
            return None

        principal = self.authenticate_token(
            token,
            request,
        )

        if principal is None:
            raise AuthenticationFailed(
                "Invalid credentials.",
            )

        user = self.get_user(principal)

        # A credential is not valid past its principal's account state:
        # deactivated/soft-deleted owners must not retain API access.
        if (
            user is None
            or not getattr(user, "is_active", False)
            or getattr(user, "is_deleted", False)
        ):
            return None

        self.on_authenticated(
            request,
            principal,
        )

        return (
            user,
            principal,
        )

    # ---------------------------------------------------------
    # Header Parsing
    # ---------------------------------------------------------

    def get_token(
        self,
        request,
    ) -> str | None:
        header = request.headers.get(
            "Authorization",
        )

        if not header:
            return None

        try:
            keyword, token = header.split(
                " ",
                1,
            )
        except ValueError:
            return None

        if keyword != self.keyword:
            return None

        return token.strip()

    # ---------------------------------------------------------
    # Request Helpers
    # ---------------------------------------------------------

    def get_client_ip(
        self,
        request,
    ) -> str | None:
        from apps.identity.authentication.utils import AuthenticationUtils

        return AuthenticationUtils.get_client_ip(
            request,
        )

    def get_user_agent(
        self,
        request,
    ) -> str:
        return request.META.get(
            "HTTP_USER_AGENT",
            "",
        )

    # ---------------------------------------------------------
    # Hooks
    # ---------------------------------------------------------

    def authenticate_token(
        self,
        token: str,
        request,
    ):
        raise NotImplementedError

    def get_user(
        self,
        principal,
    ):
        raise NotImplementedError

    def on_authenticated(
        self,
        request,
        principal,
    ):
        """
        Optional hook.
        """
        return
