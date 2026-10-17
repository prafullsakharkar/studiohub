from django.utils import timezone

from apps.identity.api_keys.hashing import APIKeyHasher
from apps.identity.authentication.base import (
    IdentityAuthentication,
)


class PersonalAccessTokenAuthentication(
    IdentityAuthentication,
):
    # Distinct from JWT's Bearer keyword on purpose: DRF re-raises the
    # first AuthenticationFailed immediately, so two Bearer schemes would
    # let only the first one listed ever succeed.
    keyword = "Token"

    def authenticate_token(
        self,
        token,
        request,
    ):
        pat = self._verify(token)

        if pat is None:
            return None

        if pat.expires_at and pat.expires_at <= timezone.now():
            return None

        return pat

    def _verify(
        self,
        plain: str,
    ):
        """Resolve an active platform PAT from a presented secret (peppered hash)."""
        from apps.identity.models import PersonalAccessToken

        if not plain or "." not in plain:
            return None
        prefix = plain.split(".", 1)[0]
        candidate = (
            PersonalAccessToken.objects.filter(
                prefix=prefix,
                is_active=True,
            ).first()
        )
        if candidate is None:
            return None
        if not APIKeyHasher.verify(plain=plain, hashed=candidate.hashed_token):
            return None
        return candidate

    def get_user(
        self,
        pat,
    ):
        return pat.user

    def on_authenticated(
        self,
        request,
        pat,
    ):
        request.personal_access_token = pat

        self.touch(
            pat,
            ip_address=self.get_client_ip(
                request,
            ),
        )

    @staticmethod
    def touch(
        pat,
        *,
        ip_address=None,
    ):
        pat.last_used_at = timezone.now()

        if ip_address:
            pat.last_used_ip = ip_address

        pat.save(
            update_fields=["last_used_at", "last_used_ip"],
        )
