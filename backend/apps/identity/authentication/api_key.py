from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.identity.api_keys.hashing import APIKeyHasher


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

        api_key = self._verify(
            token,
        )

        if api_key is None:
            raise AuthenticationFailed(
                "Invalid API Key.",
            )

        # Same account-state rule as the JWT path: a deactivated owner
        # loses access immediately.
        owner = api_key.created_by

        if owner is None or not owner.is_active:
            return None

        self._touch(
            api_key,
            ip_address=self._get_ip(request),
        )

        request.api_key = api_key

        return (
            owner,
            api_key,
        )

    def _verify(
        self,
        plain: str,
    ):
        """Resolve an active, unexpired platform ApiKey from a presented secret."""
        from apps.identity.models import ApiKey

        if not plain:
            return None
        return (
            ApiKey.objects.filter(
                hashed_key=APIKeyHasher.hash(plain),
                is_active=True,
            )
            .filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()),
            )
            .first()
        )

    def _touch(
        self,
        api_key,
        *,
        ip_address=None,
    ):
        api_key.last_used_at = timezone.now()
        update_fields = ["last_used_at"]
        if ip_address:
            api_key.last_used_ip = ip_address
            update_fields.append("last_used_ip")
        api_key.save(update_fields=update_fields)

    def _get_ip(
        self,
        request,
    ):
        from apps.identity.authentication.utils import AuthenticationUtils

        return AuthenticationUtils.get_client_ip(
            request,
        )
