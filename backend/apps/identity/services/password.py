from __future__ import annotations

from django.contrib.auth.hashers import check_password
from django.db import transaction

from apps.core.api.exceptions.authentication import InvalidCredentials
from apps.identity.validators.password import validate_password


class PasswordService:
    """
    Single entry point for password mutation.

    Both self-service change and administrative reset/create paths delegate
    here so that:

    * Django password validators run exactly once,
    * ``must_change_password`` is cleared only on a successful change,
    * every existing session/refresh token is revoked,
    * a ``PASSWORD_CHANGED`` security event is recorded.
    """

    @classmethod
    @transaction.atomic
    def set_password(
        cls,
        *,
        user,
        new_password,
        request=None,
        origin="admin",
    ):
        """
        Set a password without verifying an old password.

        Used by user creation and administrative reset. Callers that act on
        behalf of the user must use :meth:`change_password` instead.
        """

        validate_password(new_password, user=user)

        user.set_password(new_password)

        user.save(
            update_fields=[
                "password",
                "updated_at",
            ],
        )

        cls._clear_must_change_password(user)
        cls._revoke_sessions(user)
        cls._record_event(
            user=user,
            request=request,
            origin=origin,
        )

        return user

    @classmethod
    @transaction.atomic
    def change_password(
        cls,
        *,
        user,
        old_password,
        new_password,
        request=None,
    ):
        """
        Change a password after verifying the current one.

        Raises ``InvalidCredentials`` (401) when ``old_password`` does not
        match; this is the same generic failure used by login so the endpoint
        does not disclose whether the caller supplied a wrong password or is
        acting on the wrong account.
        """

        if not check_password(
            old_password,
            user.password,
        ):
            raise InvalidCredentials()

        return cls.set_password(
            user=user,
            new_password=new_password,
            request=request,
            origin="self",
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @classmethod
    def _clear_must_change_password(cls, user) -> None:
        profile = getattr(user, "profile", None)

        if profile is None or not profile.must_change_password:
            return

        profile.must_change_password = False

        profile.save(
            update_fields=[
                "must_change_password",
                "updated_at",
            ],
        )

    @classmethod
    def _revoke_sessions(cls, user) -> None:
        from apps.identity.authentication.token import TokenService

        TokenService.revoke_all_for_user(
            user=user,
        )

    @classmethod
    def _record_event(cls, *, user, request, origin) -> None:
        from apps.identity.authentication.utils import AuthenticationUtils
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        SecurityEventService.create(
            user=user,
            event_type=SecurityEventType.PASSWORD_CHANGED,
            ip_address=(
                AuthenticationUtils.get_client_ip(request) if request is not None else None
            ),
            user_agent=(request.META.get("HTTP_USER_AGENT", "") if request is not None else ""),
            description="Password changed.",
            metadata={"origin": origin},
        )

    # ------------------------------------------------------------------
    # Compatibility API
    # ------------------------------------------------------------------

    @classmethod
    def request_password_reset(
        cls,
        email,
        request=None,
    ):
        """
        Trigger the password reset flow for the given email address.

        Always returns ``None``/``False``-equivalent behaviour for unknown
        accounts so callers can keep responses generic.
        """

        from apps.identity.services.password_reset import (
            PasswordResetService,
        )

        return PasswordResetService.request_reset(
            email=email,
            request=request,
        )
