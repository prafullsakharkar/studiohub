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
    Profile,
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
    def invalidate_cache(cls, instance):
        super().invalidate_cache(instance)
        from apps.identity.services.permission_cache import PermissionCacheService

        PermissionCacheService.invalidate(user=instance)

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
    def reset_password(
        cls,
        instance,
        *,
        user=None,
    ):
        """Admin password reset: force a change on next login, revoke all."""
        profile, _ = Profile.objects.get_or_create(
            user=instance,
        )

        profile.must_change_password = True

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
            user=instance,
        )

        SecurityEventService.create(
            user=instance,
            event_type=SecurityEventType.PASSWORD_RESET,
            description="Password reset by an administrator.",
            metadata={"origin": "admin"},
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

        from apps.identity.choices import SecurityEventType
        from apps.identity.models import ApiKey, PersonalAccessToken
        from apps.identity.services.security_event import SecurityEventService

        PersonalAccessToken.objects.filter(
            user=instance,
            is_active=False,
        ).update(is_active=True)

        ApiKey.objects.filter(
            created_by=instance,
            is_active=False,
        ).update(is_active=True)

        SecurityEventService.create(
            user=instance,
            event_type=SecurityEventType.ACCOUNT_ACTIVATED,
            description="Account activated.",
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

        from apps.identity.authentication.token import TokenService
        from apps.identity.choices import SecurityEventType
        from apps.identity.models import ApiKey, PersonalAccessToken
        from apps.identity.services.security_event import SecurityEventService

        TokenService.revoke_all_for_user(
            user=instance,
        )

        PersonalAccessToken.objects.filter(
            user=instance,
            is_active=True,
        ).update(is_active=False)

        ApiKey.objects.filter(
            created_by=instance,
            is_active=True,
        ).update(is_active=False)

        SecurityEventService.create(
            user=instance,
            event_type=SecurityEventType.ACCOUNT_DEACTIVATED,
            description="Account deactivated.",
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

        from apps.identity.authentication.token import TokenService
        from apps.identity.choices import SecurityEventType
        from apps.identity.models import ApiKey, PersonalAccessToken
        from apps.identity.services.security_event import SecurityEventService

        TokenService.revoke_all_for_user(
            user=instance,
        )

        PersonalAccessToken.objects.filter(
            user=instance,
            is_active=True,
        ).update(is_active=False)

        ApiKey.objects.filter(
            created_by=instance,
            is_active=True,
        ).update(is_active=False)

        SecurityEventService.create(
            user=instance,
            event_type=SecurityEventType.ACCOUNT_DEACTIVATED,
            description="Account deactivated.",
        )

        cls.publish_event(
            cls.ARCHIVE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance
