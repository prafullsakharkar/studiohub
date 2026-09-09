from __future__ import annotations

from typing import Any

from django.contrib.auth.base_user import BaseUserManager

from apps.identity.querysets.user import UserQuerySet


# NOTE: BaseUserManager cannot be parameterized here — that would require
# importing the User model into its own manager module (circular import).
class UserManager(BaseUserManager):  # pyright: ignore[reportMissingTypeArgument]
    """Typed manager exposing UserQuerySet helpers."""

    use_in_migrations = True

    def get_queryset(self) -> UserQuerySet:
        return UserQuerySet(self.model, using=self._db)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def staff(self, *args: Any, **kwargs: Any):
        return self.get_queryset().staff(*args, **kwargs)

    def superusers(self, *args: Any, **kwargs: Any):
        return self.get_queryset().superusers(*args, **kwargs)

    def verified(self, *args: Any, **kwargs: Any):
        return self.get_queryset().verified(*args, **kwargs)

    def with_last_seen(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_last_seen(*args, **kwargs)

    def get_by_id(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_by_id(*args, **kwargs)

    def get_by_email(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_by_email(*args, **kwargs)

    def by_email(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_email(*args, **kwargs)

    def by_username(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_username(*args, **kwargs)

    def get_by_username(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_by_username(*args, **kwargs)

    def lookup(self, *args: Any, **kwargs: Any):
        return self.get_queryset().lookup(*args, **kwargs)

    def recent(self, *args: Any, **kwargs: Any):
        return self.get_queryset().recent(*args, **kwargs)

    def order_by_last_seen(self, *args: Any, **kwargs: Any):
        return self.get_queryset().order_by_last_seen(*args, **kwargs)

    def list_users(self, *args: Any, **kwargs: Any):
        return self.get_queryset().list_users(*args, **kwargs)

    def count_users(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_users(*args, **kwargs)

    def get_user_with_profile(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_user_with_profile(*args, **kwargs)

    def get_user_with_last_login(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_user_with_last_login(*args, **kwargs)

    def _create_user(
        self,
        email,
        password,
        **extra_fields,
    ):

        if not email:
            raise ValueError("Email is required.")

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            **extra_fields,
        )

        user.set_password(password)

        user.full_clean()

        user.save(using=self._db)

        return user

    def create_user(
        self,
        email,
        password=None,
        **extra_fields,
    ):
        extra_fields.setdefault(
            "is_staff",
            False,
        )

        extra_fields.setdefault(
            "is_superuser",
            False,
        )

        return self._create_user(
            email,
            password,
            **extra_fields,
        )

    def create_superuser(
        self,
        email,
        password,
        **extra_fields,
    ):

        extra_fields.setdefault(
            "is_staff",
            True,
        )

        extra_fields.setdefault(
            "is_superuser",
            True,
        )

        extra_fields.setdefault(
            "is_active",
            True,
        )

        extra_fields.setdefault(
            "is_email_verified",
            True,
        )

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(
            email,
            password,
            **extra_fields,
        )

    def system(self, *args: Any, **kwargs: Any):
        return self.get_queryset().system(*args, **kwargs)

    def custom(self, *args: Any, **kwargs: Any):
        return self.get_queryset().custom(*args, **kwargs)

    def by_name(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_name(*args, **kwargs)

    def by_code(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_code(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def count_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_all(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
