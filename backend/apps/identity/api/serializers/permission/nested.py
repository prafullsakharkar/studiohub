from apps.core.api.serializers.base import BaseNestedSerializer
from apps.identity.models import Permission


class PermissionNestedSerializer(BaseNestedSerializer):

    class Meta(BaseNestedSerializer.Meta):

        model = Permission

        fields = (
            *BaseNestedSerializer.Meta.fields,
            "name",
            "code",
        )
