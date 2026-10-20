from django.contrib.auth.hashers import check_password

from apps.core.api.exceptions.authentication import InvalidCredentials
from apps.identity.authentication.utils import AuthenticationUtils
from apps.identity.choices import SecurityEventType


class PasswordService:

    @classmethod
    def change_password(
        cls,
        *,
        user,
        old_password,
        new_password,
        request=None,
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

        from apps.identity.authentication.token import TokenService
        from apps.identity.services.security_event import SecurityEventService

        TokenService.revoke_all_for_user(
            user=user,
        )

        SecurityEventService.create(
            user=user,
            event_type=SecurityEventType.PASSWORD_CHANGED,
            ip_address=(
                AuthenticationUtils.get_client_ip(request)
                if request is not None
                else None
            ),
            user_agent=(
                request.META.get("HTTP_USER_AGENT", "")
                if request is not None
                else ""
            ),
            description="Password changed by the user.",
            metadata={"origin": "self"},
        )

    @classmethod
    def request_password_reset(
        cls,
        email,
    ):
        """
        Trigger the password reset flow for the given email address.

        Delegates to the authentication subsystem. Returns ``False`` when no
        account matches so callers can keep responses generic.
        """

        from apps.identity.services.authentication import (
            reset_password,
        )

        return reset_password(email)
