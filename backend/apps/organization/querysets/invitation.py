from django.db import models


class InvitationQuerySet(models.QuerySet):
    def pending(self):
        return self.filter(status="pending")

    def accepted(self):
        return self.filter(status="accepted")

    def declined(self):
        return self.filter(status="declined")

    def expired(self):
        return self.filter(status="expired")

    def cancelled(self):
        return self.filter(status="cancelled")

    def by_organization(self, organization):
        return self.filter(organization=organization)

    def by_user(self, user):
        return self.filter(
            models.Q(invited_by=user) | models.Q(accepted_by=user) | models.Q(email=user.email)
        )

    def active(self):
        from django.utils import timezone

        return self.filter(
            models.Q(status="pending") | models.Q(status="accepted"),
            expires_at__gt=timezone.now(),
        )
