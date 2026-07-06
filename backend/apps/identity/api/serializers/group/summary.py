from .base import GroupBaseSerializer


class GroupSummarySerializer(
    GroupBaseSerializer,
):

    class Meta(
        GroupBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
        )
