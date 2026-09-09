from apps.identity.models import SecurityEvent


class SecurityEventService:
    """
    Write operations for SecurityEvent.
    """

    model = SecurityEvent

    @classmethod
    def create(
        cls,
        *,
        user=None,
        **validated_data,
    ):
        return SecurityEvent.objects.create(
            user=user,
            **validated_data,
        )

    @classmethod
    def update(
        cls,
        instance,
        **validated_data,
    ):
        for key, value in validated_data.items():
            setattr(
                instance,
                key,
                value,
            )

        instance.save()

        return instance

    @classmethod
    def delete(
        cls,
        instance,
        **kwargs,
    ):
        instance.delete()
