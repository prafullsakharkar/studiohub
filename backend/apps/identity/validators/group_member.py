from apps.identity.models import (
    GroupMember,
)
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class GroupMemberValidator(
    IdentityBaseValidator,
):
    """
    Validator for GroupMember.
    """

    model = GroupMember

    @classmethod
    def validate_unique_membership(
        cls,
        *,
        group,
        user,
        instance=None,
    ):
        queryset = GroupMember.objects.filter(
            group=group,
            user=user,
        )

        if instance:
            queryset = queryset.exclude(
                pk=instance.pk,
            )

        if queryset.exists():
            raise ValueError(
                "User is already a member of this group.",
            )

    @classmethod
    def validate_owner(
        cls,
        *,
        group,
        is_owner,
        instance=None,
    ):
        if not is_owner:
            return

        queryset = GroupMember.objects.filter(
            group=group,
            is_owner=True,
        )

        if instance:
            queryset = queryset.exclude(
                pk=instance.pk,
            )

        if queryset.exists():
            raise ValueError(
                "Group already has an owner.",
            )

    @classmethod
    def validate_create(
        cls,
        data,
    ):
        cls.validate_unique_membership(
            group=data.get("group"),
            user=data.get("user"),
        )

        cls.validate_owner(
            group=data.get("group"),
            is_owner=data.get(
                "is_owner",
                False,
            ),
        )

    @classmethod
    def validate_update(
        cls,
        instance,
        data,
    ):
        cls.validate_unique_membership(
            group=data.get(
                "group",
                instance.group,
            ),
            user=data.get(
                "user",
                instance.user,
            ),
            instance=instance,
        )

        cls.validate_owner(
            group=data.get(
                "group",
                instance.group,
            ),
            is_owner=data.get(
                "is_owner",
                instance.is_owner,
            ),
            instance=instance,
        )
