from apps.core.api.serializers.base import BaseNestedSerializer
from apps.identity.models import OrganizationMembership


class MembershipNestedSerializer(BaseNestedSerializer):

    class Meta(BaseNestedSerializer.Meta):

        model = OrganizationMembership

        fields = (
            *BaseNestedSerializer.Meta.fields,
            "employee_id",
            "status",
        )
