from apps.identity.services.group import (
    GroupService,
)

from .base import GroupBaseSerializer


class GroupCreateSerializer(
    GroupBaseSerializer,
):

    def create(self, validated_data):
        return GroupService.create(
            **validated_data,
        )
