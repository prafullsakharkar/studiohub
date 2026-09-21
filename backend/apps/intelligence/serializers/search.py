from rest_framework import serializers

from apps.intelligence.models import RecentSearch, SavedSearch


class SavedSearchSerializer(serializers.ModelSerializer[SavedSearch]):
    id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = SavedSearch
        fields = (
            "id",
            "name",
            "description",
            "filters",
            "created_at",
            "updated_at",
            "is_favorite",
            "user_id",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "user_id",
        )


class RecentSearchSerializer(serializers.ModelSerializer[RecentSearch]):
    id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(read_only=True)
    timestamp = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = RecentSearch
        fields = (
            "id",
            "query",
            "timestamp",
            "filters_snapshot",
            "user_id",
        )
        read_only_fields = (
            "id",
            "timestamp",
            "user_id",
        )
