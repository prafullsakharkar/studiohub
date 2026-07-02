from apps.core.api.serializers.base import BaseNestedSerializer
from apps.identity.models import Role


class RoleNestedSerializer(BaseNestedSerializer):

    class Meta(BaseNestedSerializer.Meta):

        model = Role

        fields = (
            *BaseNestedSerializer.Meta.fields,
            "name",
            "code",
        )
