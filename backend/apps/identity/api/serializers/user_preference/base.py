from apps.identity.models import UserPreference

from ..base import IdentitySerializer


class UserPreferenceBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = UserPreference

        fields = (
            "id",
            "uuid",
            "user",
            "language",
            "timezone",
            "theme",
            "date_format",
            "time_format",
            "default_organization",
            "default_department",
            "start_page",
            "items_per_page",
            "email_notifications",
            "desktop_notifications",
            "push_notifications",
            "review_notifications",
            "task_notifications",
            "mention_notifications",
            "metadata",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
