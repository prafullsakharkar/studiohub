from apps.core.api.serializers.base import BaseNestedSerializer
from apps.identity.models import User


class UserNestedSerializer(BaseNestedSerializer):

    class Meta(BaseNestedSerializer.Meta):

        model = User

        fields = (
            *BaseNestedSerializer.Meta.fields,
            "first_name",
            "last_name",
            "email",
        )
