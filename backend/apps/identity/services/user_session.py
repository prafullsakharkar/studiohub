from __future__ import annotations

from django.utils import timezone

from apps.core.services.business import BusinessService
from apps.identity.choices import (
    LogoutReason,
    SessionStatus,
)
from apps.identity.events.user_session import (
    SessionCreated,
    SessionCurrentChanged,
    SessionExpired,
    SessionLoggedOut,
    SessionRefreshed,
    SessionRevoked,
    SessionTouched,
    SessionTrusted,
    SessionUpdated,
)
from apps.organization.models import UserSession
from apps.organization.selectors.user_session import (
    UserSessionSelector,
)
from apps.organization.validators.user_session import (
    UserSessionValidator,
)


class UserSessionService(
    BusinessService,
):
    """
    Enterprise User Session Service.
    """

    model = UserSession

    selector_class = UserSessionSelector

    # ---------------------------------------------------------
    # CRUD
    # ---------------------------------------------------------

    @classmethod
    def create(
        cls,
        **validated_data,
    ):
        # ``user`` is a real model field on ``UserSession`` (the session
        # owner). ``BusinessService.create`` would treat it as the audit
        # actor and drop it, so create the session directly here.
        owner = validated_data.pop(
            "user",
            None,
        )

        instance = cls.model.objects.create(
            user=owner,
            **validated_data,
        )

        SessionCreated.dispatch(
            instance=instance,
        )

        return instance

    @classmethod
    def update(
        cls,
        instance,
        **validated_data,
    ):
        instance = super().update(
            instance,
            **validated_data,
        )

        SessionUpdated.dispatch(
            instance=instance,
        )

        return instance

    # ---------------------------------------------------------
    # Login
    # ---------------------------------------------------------

    @classmethod
    def create_login_session(
        cls,
        **validated_data,
    ):
        validated_data.setdefault(
            "status",
            SessionStatus.ACTIVE,
        )

        validated_data.setdefault(
            "is_current",
            True,
        )

        return cls.create(
            **validated_data,
        )

    # ---------------------------------------------------------
    # Activity
    # ---------------------------------------------------------

    @classmethod
    def touch(
        cls,
        session,
    ):
        session.last_activity = timezone.now()

        session.save(
            update_fields=[
                "last_activity",
            ],
        )

        SessionTouched.dispatch(
            instance=session,
        )

        return session

    # ---------------------------------------------------------
    # Refresh
    # ---------------------------------------------------------

    @classmethod
    def refresh(
        cls,
        session,
        *,
        access_token_jti,
        refresh_token_jti,
    ):
        UserSessionValidator.validate_refresh(
            session,
        )

        session.access_token_jti = access_token_jti

        session.refresh_token_jti = refresh_token_jti

        session.save(
            update_fields=[
                "access_token_jti",
                "refresh_token_jti",
            ],
        )

        SessionRefreshed.dispatch(
            instance=session,
        )

        return session

    # ---------------------------------------------------------
    # Logout
    # ---------------------------------------------------------

    @classmethod
    def logout(
        cls,
        session,
        *,
        reason=LogoutReason.USER,
    ):
        UserSessionValidator.validate_logout(
            session,
        )

        session.status = SessionStatus.LOGGED_OUT

        session.logout_reason = reason

        session.logged_out_at = timezone.now()

        session.is_current = False

        session.save(
            update_fields=[
                "status",
                "logout_reason",
                "logged_out_at",
                "is_current",
            ],
        )

        SessionLoggedOut.dispatch(
            instance=session,
        )

        return session

    @classmethod
    def logout_all(
        cls,
        *,
        user,
        reason=LogoutReason.USER,
    ):
        sessions = list(
            UserSession.objects.active().by_user(
                user,
            ),
        )

        for session in sessions:
            cls.logout(
                session,
                reason=reason,
            )

        return len(sessions)

    @classmethod
    def logout_other_devices(
        cls,
        *,
        current_session,
    ):
        sessions = list(
            UserSession.objects.active()
            .by_user(current_session.user)
            .exclude(
                pk=current_session.pk,
            ),
        )

        for session in sessions:
            cls.logout(
                session,
                reason=LogoutReason.USER,
            )

        return len(sessions)

    # ---------------------------------------------------------
    # Security
    # ---------------------------------------------------------

    @classmethod
    def revoke(
        cls,
        session,
    ):
        session.status = SessionStatus.REVOKED

        session.is_current = False

        session.logged_out_at = timezone.now()

        session.save(
            update_fields=[
                "status",
                "is_current",
                "logged_out_at",
            ],
        )

        SessionRevoked.dispatch(
            instance=session,
        )

        return session

    @classmethod
    def expire(
        cls,
        session,
    ):
        session.status = SessionStatus.EXPIRED

        session.logged_out_at = timezone.now()

        session.save(
            update_fields=[
                "status",
                "logged_out_at",
            ],
        )

        SessionExpired.dispatch(
            instance=session,
        )

        return session

    @classmethod
    def mark_current(
        cls,
        session,
    ):
        UserSession.objects.filter(
            user=session.user,
        ).update(
            is_current=False,
        )

        session.is_current = True

        session.save(
            update_fields=[
                "is_current",
            ],
        )

        SessionCurrentChanged.dispatch(
            instance=session,
        )

        return session

    @classmethod
    def trust(
        cls,
        session,
    ):
        session.is_trusted = True

        session.save(
            update_fields=[
                "is_trusted",
            ],
        )

        SessionTrusted.dispatch(
            instance=session,
        )

        return session

    # ---------------------------------------------------------
    # Maintenance
    # ---------------------------------------------------------

    @classmethod
    def cleanup(
        cls,
    ):
        sessions = list(
            UserSession.objects.active().expired(),
        )

        for session in sessions:
            cls.expire(
                session,
            )

        return len(sessions)
