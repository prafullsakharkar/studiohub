from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
)
from django.core.validators import validate_email
from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.managers import UserManager


class User(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
    AbstractBaseUser,
    PermissionsMixin,
):

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
        self.email = self.__class__.objects.normalize_email(self.email)

    def get_full_name(self):
        return self.full_name

    def get_short_name(self):
        return self.full_name.split()[0]

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
