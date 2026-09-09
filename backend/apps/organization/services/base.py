from django.db import transaction


class OrganizationBaseService:
    """
    Base service for Organization bounded-context entities.
    """

    model = None

    @classmethod
    @transaction.atomic
    def create_instance(cls, **validated_data):
        assert cls.model is not None, "model must be set on the service class."
        return cls.model.objects.create(**validated_data)

    @classmethod
    @transaction.atomic
    def update_instance(cls, instance, **validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        return instance

    @classmethod
    @transaction.atomic
    def delete_instance(cls, instance):
        instance.delete()


    @classmethod
    @transaction.atomic
    def restore_instance(cls, instance):
        instance.restore()
