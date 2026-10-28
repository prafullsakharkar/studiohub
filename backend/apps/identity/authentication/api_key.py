from __future__ import annotations

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.identity.api_keys.resolver import CredentialResolver


class APIKeyAuthentication(
    BaseAuthentication,
):
    """
    Authenticate requests using API Keys.

    Authorization: Api-Key <prefix.secret>

    The key acts as its principal (owner, else creator). Scope restrictions
    are applied by ``HasPermission`` from ``request.auth``.
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

        api_key = self._verify(
            token.strip(),
        )

        if api_key is None:
            raise AuthenticationFailed(
                "Invalid API Key.",
            )

        # Same account-state rule as the JWT path: a deactivated or deleted
        # principal loses access immediately. One message, so a caller cannot
        # tell a dead key from a dead account.
        principal = api_key.principal

        if principal is None or not principal.is_active or getattr(principal, "is_deleted", False):
            raise AuthenticationFailed(
                "Invalid API Key.",
            )

        from apps.identity.models import ApiKey
        from apps.identity.permissions.scopes import gate_scoped_credential

        gate_scoped_credential(request, api_key)

        CredentialResolver.touch(
            ApiKey,
            api_key,
            ip_address=self._get_ip(request),
        )

        request.api_key = api_key

        return (
            principal,
            api_key,
        )

    def _verify(
        self,
        plain: str,
    ):
        """Resolve a live platform ApiKey from a presented secret."""
        from apps.identity.models import ApiKey

        return CredentialResolver.resolve(
            model=ApiKey,
            hash_field="hashed_key",
            plain=plain,
        )

    def _get_ip(
        self,
        request,
    ):
        from apps.identity.authentication.utils import AuthenticationUtils

        return AuthenticationUtils.get_client_ip(
            request,
        )
