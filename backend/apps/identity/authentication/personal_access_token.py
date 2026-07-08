from apps.identity.authentication.base import (
    IdentityAuthentication,
)
from apps.identity.services import (
    PersonalAccessTokenService,
)


class PersonalAccessTokenAuthentication(
    IdentityAuthentication,
):
    keyword = "Bearer"

    def authenticate_token(
        self,
        token,
        request,
    ):
        return PersonalAccessTokenService.verify(
            token,
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
        request.personal_access_token = pat

        PersonalAccessTokenService.touch(
            pat,
            ip_address=self.get_client_ip(
                request,
            ),
        )
