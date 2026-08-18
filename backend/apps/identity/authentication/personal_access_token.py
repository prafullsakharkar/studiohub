from django.utils import timezone

from apps.identity.authentication.base import (
    IdentityAuthentication,
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
        from apps.organization.models import (
            PersonalAccessToken,
        )

        pat = (
            PersonalAccessToken.objects.filter(
                hashed_token=token,
                is_active=True,
            )
            .select_related("user")
            .first()
        )

        if pat is None:
            return None

        if pat.expires_at and pat.expires_at <= timezone.now():
            return None

        return pat

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
