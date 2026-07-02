from apps.identity.api.serializers.membership.write import MembershipWriteSerializer


class MembershipUpdateSerializer(
    MembershipWriteSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return self.context["view"].service_class.update(
            instance,
            **validated_data,
        )
