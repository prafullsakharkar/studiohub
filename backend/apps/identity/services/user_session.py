from django.db import transaction
from django.utils import timezone

from apps.core.events import EventBus
from apps.identity.events.user_session import (
    SessionActivityUpdated,
    SessionCreated,
    SessionRevoked,
)
from apps.identity.models import UserSession
from apps.identity.services.base import (
    IdentityBaseService,
)


class UserSessionService(
    IdentityBaseService,
):

    model = UserSession

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):

        session = cls.create_instance(
            **validated_data,
        )

        EventBus.publish(
            SessionCreated(
                instance=session,
            )
        )

        return session

    @classmethod
    @transaction.atomic
    def update_activity(
        cls,
        session,
    ):

        session.last_activity_at = timezone.now()

        session.save(
            update_fields=[
                "last_activity_at",
            ]
        )

        EventBus.publish(
            SessionActivityUpdated(
                instance=session,
            )
        )

        return session

    @classmethod
    @transaction.atomic
    def revoke(
        cls,
        session,
        *,
        revoked_by=None,
    ):

        session.is_revoked = True
        session.revoked_at = timezone.now()
        session.revoked_by = revoked_by

        session.save(
            update_fields=[
                "is_revoked",
                "revoked_at",
                "revoked_by",
            ]
        )

        EventBus.publish(
            SessionRevoked(
                instance=session,
            )
        )

        return session

    @classmethod
    @transaction.atomic
    def revoke_all(
        cls,
        *,
        user,
        revoked_by=None,
    ):

        sessions = cls.model.objects.active().for_user(user)

        for session in sessions:
            cls.revoke(
                session,
                revoked_by=revoked_by,
            )

        return sessions
