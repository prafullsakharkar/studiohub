from django.contrib.auth.backends import ModelBackend

from apps.identity.selectors.authentication import (
    AuthenticationSelector,
)
from apps.identity.validators.authentication import (
    AuthenticationValidator,
)


class EnterpriseAuthenticationBackend(
    ModelBackend,
):
    """
    Enterprise authentication backend.
    """

    def authenticate(
        self,
        request,
        username=None,
        password=None,
        **kwargs,
    ):
        if not username or not password:
            return None

        user = AuthenticationSelector.get_user(
            username=username,
        )

        try:
            AuthenticationValidator.validate_login(
                username=username,
                password=password,
                user=user,
                ip_address="",
            )
        except Exception:
            return None

        return user
