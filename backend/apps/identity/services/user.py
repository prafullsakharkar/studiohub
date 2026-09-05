from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    UserActivated,
    UserArchived,
    UserCreated,
    UserDeactivated,
    UserDeleted,
    UserRestored,
    UserUpdated,
)
from apps.identity.models import (
    User,
)
from apps.identity.validators.user import (
    UserValidator,
)


class UserService(
    BusinessService,
):
    """
    Write operations for User.
    """

    model = User

    validator_class = UserValidator

    event_map = {
        "create": UserCreated,
        "update": UserUpdated,
        "delete": UserDeleted,
        "restore": UserRestored,
        "archive": UserArchived,
        "activate": UserActivated,
        "deactivate": UserDeactivated,
    }

    @classmethod
    def create(
        cls,
        *,
        user=None,
        **validated_data,
    ):
        from apps.identity.services.user_password import (
            UserPasswordService,
        )

        password = validated_data.pop(
            "password",
            None,
        )

        instance = super().create(
            user=user,
            **validated_data,
        )

        if password:
            UserPasswordService.set_password(
                user=instance,
                password=password,
            )

        return instance

    @classmethod
    def activate(
        cls,
        instance,
        *,
        user=None,
    ):
        """
        Activate a user.

        ``User`` has no lifecycle ``status`` column, so the base
        ``LifecycleService.change_status`` flow is replaced with the
        ``is_active`` flag while keeping event publishing and cache
        invalidation.
        """

        instance.is_active = True

        instance.save(
            update_fields=[
                "is_active",
                "updated_at",
            ],
        )

        cls.publish_event(
            cls.ACTIVATE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    def deactivate(
        cls,
        instance,
        *,
        user=None,
    ):
        """
        Deactivate a user via the ``is_active`` flag.
        """

        instance.is_active = False

        instance.save(
            update_fields=[
                "is_active",
                "updated_at",
            ],
        )

        cls.publish_event(
            cls.DEACTIVATE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    def archive(
        cls,
        instance,
        *,
        user=None,
    ):
        """
        Archive a user.

        ``User`` has no lifecycle ``status`` column, so archival maps onto
        deactivation (``is_active``) while publishing the distinct ARCHIVE
        event for audit purposes.
        """

        instance.is_active = False

        instance.save(
            update_fields=[
                "is_active",
                "updated_at",
            ],
        )

        cls.publish_event(
            cls.ARCHIVE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance
