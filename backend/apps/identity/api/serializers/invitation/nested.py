from rest_framework import serializers

from apps.identity.models import Invitation


class InvitationNestedSerializer(
    serializers.ModelSerializer,
):

    class Meta:

        model = Invitation

        fields = (
            "uuid",
            "email",
            "status",
        )
