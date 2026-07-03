from django.contrib.auth.hashers import check_password

from apps.core.api.exceptions.authentication import InvalidCredentials


class PasswordService:

    @classmethod
    def change_password(
        cls,
        *,
        user,
        old_password,
        new_password,
    ):

        if not check_password(
            old_password,
            user.password,
        ):
            raise InvalidCredentials()

        user.set_password(
            new_password,
        )

        user.save(
            update_fields=[
                "password",
            ]
        )
