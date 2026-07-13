from django.contrib.auth.hashers import make_password

from apps.core.services.business import (
    BusinessService,
)
from apps.identity.models import (
    User,
)


class UserPasswordService(
    BusinessService,
):
    """
    User password operations.
    """

    model = User

    @classmethod
    def change_password(
        cls,
        user,
        password,
    ):
        user.password = make_password(
            password,
        )

        user.save(
            update_fields=[
                "password",
                "updated_at",
            ],
        )

        return user

    @classmethod
    def set_password(
        cls,
        user,
        password,
    ):
        return cls.change_password(
            user,
            password,
        )
