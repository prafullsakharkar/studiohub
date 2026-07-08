from rest_framework import serializers

from .base import (
    PersonalAccessTokenBaseSerializer,
)


class PersonalAccessTokenCreateSerializer(
    PersonalAccessTokenBaseSerializer,
):
    token = serializers.CharField(
        read_only=True,
    )

    class Meta(
        PersonalAccessTokenBaseSerializer.Meta,
    ):
        read_only_fields = (
            *PersonalAccessTokenBaseSerializer.Meta.read_only_fields,
            "token",
        )
