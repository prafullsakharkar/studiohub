from apps.identity.api_keys.resolver import CredentialResolver
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
        return self._verify(token)

    def _verify(
        self,
        plain: str,
    ):
        """Resolve a live platform PAT from a presented secret (peppered digest)."""
        from apps.identity.models import PersonalAccessToken

        return CredentialResolver.resolve(
            model=PersonalAccessToken,
            hash_field="hashed_token",
            plain=plain,
        )

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
        from apps.identity.models import PersonalAccessToken

        request.personal_access_token = pat

        CredentialResolver.touch(
            PersonalAccessToken,
            pat,
            ip_address=self.get_client_ip(
                request,
            ),
        )
