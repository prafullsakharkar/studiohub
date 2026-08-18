from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
)
from django.core.validators import validate_email
from django.db import models

from apps.core.models import EntityModel
from apps.identity.managers import UserManager


class User(EntityModel, AbstractBaseUser, PermissionsMixin):

    email = models.EmailField(
        unique=True,
        db_index=True,
        validators=[
            validate_email,
        ],
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    is_staff = models.BooleanField(
        default=False,
    )

    is_email_verified = models.BooleanField(
        default=False,
        db_index=True,
    )

    last_seen = models.DateTimeField(
        blank=True,
        null=True,
        db_index=True,
    )

    objects = UserManager()

    USERNAME_FIELD = "email"

    class Meta:
        db_table = "identity_users"

        ordering = [
            "email",
        ]

        indexes = [
            models.Index(
                fields=["email"],
            ),
            models.Index(
                fields=["last_seen"],
            ),
            models.Index(
                fields=["is_email_verified"],
            ),
        ]

    def clean(self):
        self.email = self.__class__.objects.normalize_email(self.email).lower()

    def get_full_name(self):
        return self.full_name

    def get_short_name(self):
        parts = (self.full_name or "").split()

        return parts[0] if parts else self.email

    @property
    def username(self):
        """Usernames are the user's email address in this system."""
        return self.email

    @property
    def organizations(self):
        """
        Organizations the user belongs to (via organization memberships).
        """
        from apps.organization.models import Organization

        return Organization.objects.filter(
            memberships__user=self,
        )

    @property
    def display_name(self):

        if hasattr(self, "profile"):
            return self.profile.display_name

        return self.email

    @property
    def full_name(self):

        if hasattr(self, "profile"):
            return self.profile.full_name

        return self.email

    def __str__(self):
        return self.display_name
