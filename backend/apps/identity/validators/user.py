from apps.identity.models import (
    User,
)
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class UserValidator(
    IdentityBaseValidator,
):
    """
    Validator for User.
    """

    model = User

    @classmethod
    def validate_email_unique(
        cls,
        email,
        instance=None,
    ):
        queryset = User.objects.filter(
            email=email,
        )

        if instance:
            queryset = queryset.exclude(
                pk=instance.pk,
            )

        if queryset.exists():
            raise ValueError(
                "User with this email already exists.",
            )

    @classmethod
    def validate_email(
        cls,
        email,
    ):
        if not email:
            raise ValueError(
                "Email is required.",
            )

    @classmethod
    def validate_create(
        cls,
        data,
    ):
        cls.validate_email(
            data.get("email"),
        )

        cls.validate_email_unique(
            data.get("email"),
        )

    @classmethod
    def validate_update(
        cls,
        instance,
        data,
    ):
        if "email" in data:
            cls.validate_email_unique(
                data["email"],
                instance,
            )
