from apps.identity.api.serializers.base import IdentitySerializer
from apps.identity.models import Invitation


class InvitationBaseSerializer(IdentitySerializer):

    class Meta(IdentitySerializer.Meta):

        model = Invitation

        fields = (
            *IdentitySerializer.Meta.fields,
            "email",
            "invitation_type",
            "status",
            "message",
            "expires_at",
            "accepted_at",
        )
