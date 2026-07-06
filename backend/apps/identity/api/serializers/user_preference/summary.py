from .base import UserPreferenceBaseSerializer


class UserPreferenceSummarySerializer(
    UserPreferenceBaseSerializer,
):

    class Meta(
        UserPreferenceBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "user",
            "theme",
            "language",
            "timezone",
        )
