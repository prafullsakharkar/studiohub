from apps.identity.api.serializers.membership.write import MembershipWriteSerializer
from apps.identity.validators.membership import MembershipValidator


class MembershipCreateSerializer(
    MembershipWriteSerializer,
):

    def validate(self, attrs):

        attrs = super().validate(attrs)

        MembershipValidator.validate(attrs)

        return attrs

    def create(self, validated_data):

        return self.context["view"].service_class.create(
            **validated_data,
        )
