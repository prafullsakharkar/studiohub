from .base import APIKeyBaseSerializer


class APIKeyUpdateSerializer(
    APIKeyBaseSerializer,
):
    class Meta(APIKeyBaseSerializer.Meta):
        read_only_fields = (
            *APIKeyBaseSerializer.Meta.read_only_fields,
            "organization",
            "created_by",
            "prefix",
        )
