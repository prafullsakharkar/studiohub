from .base import (
    PersonalAccessTokenBaseSerializer,
)


class PersonalAccessTokenUpdateSerializer(
    PersonalAccessTokenBaseSerializer,
):
    class Meta(
        PersonalAccessTokenBaseSerializer.Meta,
    ):
        read_only_fields = (
            *PersonalAccessTokenBaseSerializer.Meta.read_only_fields,
            "user",
            "prefix",
        )
