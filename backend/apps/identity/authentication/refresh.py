from apps.identity.services.authentication import (
    AuthenticationService,
)


class RefreshManager:
    """
    Refresh facade.
    """

    @classmethod
    def execute(
        cls,
        **kwargs,
    ):
        return AuthenticationService.refresh(
            **kwargs,
        )
