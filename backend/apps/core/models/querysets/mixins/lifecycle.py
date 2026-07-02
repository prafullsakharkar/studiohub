from apps.core.choices.lifecycle import LifecycleStatus


class LifecycleQuerySetMixin:
    """
    QuerySet lifecycle helpers.
    """

    def active(self):
        return self.filter(status=LifecycleStatus.ACTIVE)

    def inactive(self):
        return self.filter(status=LifecycleStatus.INACTIVE)

    def archived(self):
        return self.filter(status=LifecycleStatus.ARCHIVED)

    def draft(self):
        return self.filter(status=LifecycleStatus.DRAFT)
