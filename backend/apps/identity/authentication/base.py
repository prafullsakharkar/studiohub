from __future__ import annotations

from typing import Optional, Tuple

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
    ) -> Optional[Tuple[User, object]]:
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

        self.on_authenticated(
            request,
            principal,
        )

        return (
            self.get_user(principal),
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
        forwarded = request.META.get(
            "HTTP_X_FORWARDED_FOR",
        )

        if forwarded:
            return forwarded.split(",")[0].strip()

        return request.META.get(
            "REMOTE_ADDR",
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
