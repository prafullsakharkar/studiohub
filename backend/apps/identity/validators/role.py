from apps.identity.models import (
    Role,
)
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class RoleValidator(
    IdentityBaseValidator,
):
    """
    Validator for Role.
    """

    model = Role

    @classmethod
    def validate_code_unique(
        cls,
        code,
        organization=None,
        instance=None,
    ):
        queryset = Role.objects.filter(
            code=code,
            organization=organization,
        )

        if instance:
            queryset = queryset.exclude(
                pk=instance.pk,
            )

        if queryset.exists():
            raise ValueError(
                "Role with this code already exists.",
            )

    @classmethod
    def validate_parent(
        cls,
        parent,
        instance=None,
    ):
        if not parent:
            return

        if instance and parent.pk == instance.pk:
            raise ValueError(
                "A role cannot be its own parent.",
            )

    @classmethod
    def validate_create(
        cls,
        data,
    ):
        cls.validate_code_unique(
            data.get("code"),
            data.get("organization"),
        )

        cls.validate_parent(
            data.get("parent"),
        )

    @classmethod
    def validate_update(
        cls,
        instance,
        data,
    ):
        cls.validate_code_unique(
            data.get(
                "code",
                instance.code,
            ),
            data.get(
                "organization",
                instance.organization,
            ),
            instance,
        )

        cls.validate_parent(
            data.get(
                "parent",
                instance.parent,
            ),
            instance,
        )
