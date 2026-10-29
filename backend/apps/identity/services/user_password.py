from __future__ import annotations

from apps.core.services.business import (
    BusinessService,
)
from apps.identity.models import (
    User,
)
from apps.identity.services.password import (
    PasswordService,
)


class UserPasswordService(
    BusinessService,
):
    """
    Administrative password operations.

    Kept as a thin compatibility facade over :class:`PasswordService`, which is
    the single owner of password validation, session revocation, and audit
    events. Self-service changes must call ``PasswordService.change_password``
    so the current password is verified.
    """

    model = User

    @classmethod
    def change_password(
        cls,
        user,
        password,
        *,
        request=None,
    ):
        return PasswordService.set_password(
            user=user,
            new_password=password,
            request=request,
            origin="admin",
        )

    @classmethod
    def set_password(
        cls,
        user,
        password,
        *,
        request=None,
    ):
        return cls.change_password(
            user,
            password,
            request=request,
        )
