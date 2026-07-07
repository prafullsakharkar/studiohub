from apps.identity.services.authentication import (
    AuthenticationService,
)


class LoginManager:
    """
    Login facade.
    """

    @classmethod
    def execute(
        cls,
        **kwargs,
    ):
        return AuthenticationService.login(
            **kwargs,
        )
