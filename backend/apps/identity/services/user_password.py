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
        from django.contrib.auth.password_validation import validate_password

        validate_password(password, user=user)

        user.password = make_password(
            password,
        )

        user.save(
            update_fields=[
                "password",
                "updated_at",
            ],
        )

        profile = getattr(
            user,
            "profile",
            None,
        )

        if profile and profile.must_change_password:
            profile.must_change_password = False

            profile.save(
                update_fields=[
                    "must_change_password",
                    "updated_at",
                ],
            )

        from apps.identity.authentication.token import TokenService
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        TokenService.revoke_all_for_user(
            user=user,
        )

        SecurityEventService.create(
            user=user,
            event_type=SecurityEventType.PASSWORD_CHANGED,
            description="Password changed via the admin/user management path.",
            metadata={"origin": "admin"},
        )

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
