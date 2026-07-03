from .write import InvitationWriteSerializer


class InvitationUpdateSerializer(
    InvitationWriteSerializer,
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
