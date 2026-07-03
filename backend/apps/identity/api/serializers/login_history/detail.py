from apps.identity.api.serializers.user_session import UserSessionListSerializer


class UserSessionDetailSerializer(
    UserSessionListSerializer,
):

    class Meta(UserSessionListSerializer.Meta):

        fields = UserSessionListSerializer.Meta.fields + (
            "user_agent",
            "session_key",
            "refresh_token_jti",
            "created_at",
            "updated_at",
        )
