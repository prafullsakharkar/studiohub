from django.db import models


class InvitationManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().select_related(
            "organization",
            "department",
            "team",
            "role",
            "invited_by",
        )

    def pending(self):
        return self.get_queryset().filter(status="pending")

    def accepted(self):
        return self.get_queryset().filter(status="accepted")

    def declined(self):
        return self.get_queryset().filter(status="declined")

    def expired(self):
        return self.get_queryset().filter(status="expired")

    def cancelled(self):
        return self.get_queryset().filter(status="cancelled")
