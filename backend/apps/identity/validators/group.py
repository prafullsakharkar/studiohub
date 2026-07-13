from apps.identity.models import (
    Group,
)
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class GroupValidator(
    IdentityBaseValidator,
):
    """
    Validator for Group.
    """

    model = Group

    @classmethod
    def validate_name_unique(
        cls,
        *,
        name,
        organization=None,
        instance=None,
    ):
        queryset = Group.objects.filter(
            name=name,
            organization=organization,
        )

        if instance:
            queryset = queryset.exclude(
                pk=instance.pk,
            )

        if queryset.exists():
            raise ValueError(
                "A group with this name already exists.",
            )

    @classmethod
    def validate_parent(
        cls,
        *,
        parent,
        instance=None,
    ):
        if not parent:
            return

        if instance and parent.pk == instance.pk:
            raise ValueError(
                "A group cannot be its own parent.",
            )

    @classmethod
    def validate_create(
        cls,
        data,
    ):
        cls.validate_name_unique(
            name=data.get("name"),
            organization=data.get("organization"),
        )

        cls.validate_parent(
            parent=data.get("parent"),
        )

    @classmethod
    def validate_update(
        cls,
        instance,
        data,
    ):
        cls.validate_name_unique(
            name=data.get(
                "name",
                instance.name,
            ),
            organization=data.get(
                "organization",
                instance.organization,
            ),
            instance=instance,
        )

        cls.validate_parent(
            parent=data.get(
                "parent",
                instance.parent,
            ),
            instance=instance,
        )
