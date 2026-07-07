from apps.identity.services.authentication import (
    AuthenticationService,
)


class LogoutManager:
    """
    Logout facade.
    """

    @classmethod
    def execute(
        cls,
        **kwargs,
    ):
        return AuthenticationService.logout(
            **kwargs,
        )
