from __future__ import annotations

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class APIKeyAuthentication(
    BaseAuthentication,
):
    """
    Authenticate requests using API Keys.

    Authorization: Api-Key <token>
    """

    keyword = "Api-Key"

    def authenticate(
        self,
        request,
    ):
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

        # Imported lazily to avoid a circular import between
        # apps.identity.services and apps.identity.authentication.
        from apps.identity.services import APIKeyService

        api_key = APIKeyService.verify(
            token,
        )

        if api_key is None:
            raise AuthenticationFailed(
                "Invalid API Key.",
            )

        APIKeyService.touch(
            api_key,
            ip_address=self._get_ip(request),
        )

        request.api_key = api_key

        return (
            api_key.created_by,
            api_key,
        )

    def _get_ip(
        self,
        request,
    ):
        forwarded = request.META.get(
            "HTTP_X_FORWARDED_FOR",
        )

        if forwarded:
            return forwarded.split(",")[0].strip()

        return request.META.get(
            "REMOTE_ADDR",
        )
