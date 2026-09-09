class RefreshManager:
    """
    Refresh facade.
    """

    @classmethod
    def execute(
        cls,
        **kwargs,
    ):
        # Imported lazily to avoid a circular import with
        # ``apps.identity.services.authentication``.
        from apps.identity.services.authentication import (
            AuthenticationService,
        )

        return AuthenticationService.refresh(
            **kwargs,
        )
