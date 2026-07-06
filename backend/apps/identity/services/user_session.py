from django.utils import timezone

from apps.core.events import EventBus
from apps.core.services.business import BusinessService
from apps.identity.events import (
    UserSessionActivated,
    UserSessionArchived,
    UserSessionCreated,
    UserSessionDeactivated,
    UserSessionDeleted,
    UserSessionExpired,
    UserSessionRestored,
    UserSessionRevoked,
    UserSessionUpdated,
)
from apps.identity.models import UserSession
from apps.identity.validators.user_session import (
    UserSessionValidator,
)


class UserSessionService(
    BusinessService,
):
    """
    Write operations for UserSession.
    """

    model = UserSession

    validator_class = UserSessionValidator

    event_map = {
        "create": UserSessionCreated,
        "update": UserSessionUpdated,
        "delete": UserSessionDeleted,
        "restore": UserSessionRestored,
        "archive": UserSessionArchived,
        "activate": UserSessionActivated,
        "deactivate": UserSessionDeactivated,
    }

    @classmethod
    def revoke(
        cls,
        instance,
    ):
        instance.is_active = False
        instance.revoked_at = timezone.now()

        instance.save(
            update_fields=[
                "is_active",
                "revoked_at",
            ]
        )

        EventBus.publish(
            UserSessionRevoked(
                instance=instance,
            )
        )

        return instance

    @classmethod
    def expire(
        cls,
        instance,
    ):
        instance.is_active = False

        instance.save(
            update_fields=[
                "is_active",
            ]
        )

        EventBus.publish(
            UserSessionExpired(
                instance=instance,
            )
        )

        return instance

    @classmethod
    def touch(
        cls,
        instance,
    ):
        instance.last_activity = timezone.now()

        instance.save(
            update_fields=[
                "last_activity",
            ]
        )

        return instance

    @classmethod
    def revoke_all_for_user(
        cls,
        user,
    ):
        """
        Revoke every active session for a user.
        """

        sessions = cls.model.objects.filter(
            user=user,
            is_active=True,
            revoked_at__isnull=True,
        )

        now = timezone.now()

        sessions.update(
            is_active=False,
            revoked_at=now,
        )

        for session in sessions:
            EventBus.publish(
                UserSessionRevoked(
                    instance=session,
                )
            )

        return sessions

    @classmethod
    def revoke_other_sessions(
        cls,
        *,
        user,
        current_session,
    ):
        """
        Revoke every session except the current one.
        """

        sessions = cls.model.objects.filter(
            user=user,
            is_active=True,
            revoked_at__isnull=True,
        ).exclude(
            pk=current_session.pk,
        )

        now = timezone.now()

        sessions.update(
            is_active=False,
            revoked_at=now,
        )

        for session in sessions:
            EventBus.publish(
                UserSessionRevoked(
                    instance=session,
                )
            )

        return sessions

    @classmethod
    def cleanup_expired(cls):
        """
        Mark expired sessions inactive.
        """

        sessions = cls.model.objects.filter(
            is_active=True,
            expires_at__lte=timezone.now(),
        )

        sessions.update(
            is_active=False,
        )

        for session in sessions:
            EventBus.publish(
                UserSessionExpired(
                    instance=session,
                )
            )

        return sessions

    @classmethod
    def cleanup_revoked(cls):
        """
        Permanently remove revoked sessions.
        """

        return cls.model.objects.filter(
            revoked_at__isnull=False,
        ).delete()

    @classmethod
    def cleanup_deleted_users(cls):
        """
        Remove orphaned sessions.
        """

        return cls.model.objects.filter(
            user__isnull=True,
        ).delete()
