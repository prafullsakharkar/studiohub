from apps.identity.services.group import (
    GroupService,
)

from .base import GroupBaseSerializer


class GroupUpdateSerializer(
    GroupBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return GroupService.update(
            instance,
            **validated_data,
        )
