from apps.core.choices.lifecycle import LifecycleStatus


class LifecycleService:
    """
    Generic lifecycle operations.
    """

    @staticmethod
    def activate(instance):
        instance.status = LifecycleStatus.ACTIVE
        instance.save(update_fields=["status"])

    @staticmethod
    def deactivate(instance):
        instance.status = LifecycleStatus.INACTIVE
        instance.save(update_fields=["status"])

    @staticmethod
    def archive(instance):
        instance.status = LifecycleStatus.ARCHIVED
        instance.save(update_fields=["status"])

    @staticmethod
    def draft(instance):
        instance.status = LifecycleStatus.DRAFT
        instance.save(update_fields=["status"])
