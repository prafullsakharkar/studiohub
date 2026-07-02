class LifecycleManagerMixin:
    """
    Manager lifecycle helpers.
    """

    def active(self):
        return self.get_queryset().active()

    def inactive(self):
        return self.get_queryset().inactive()

    def archived(self):
        return self.get_queryset().archived()

    def draft(self):
        return self.get_queryset().draft()
