from rest_framework import serializers


class MeSerializer(
    serializers.Serializer,
):
    def to_representation(
        self,
        instance,
    ):
        user = instance["user"]
        session = instance["current_session"]

        return {
            "uuid": str(user.uuid),
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "session": {
                "uuid": str(session.uuid) if session else None,
                "device": session.device_name if session else None,
                "browser": session.browser if session else None,
                "ip_address": session.ip_address if session else None,
            },
        }
