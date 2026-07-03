from django.utils import timezone

from apps.identity.choices import InvitationStatus
from apps.identity.querysets.base import IdentityQuerySet


class InvitationQuerySet(IdentityQuerySet):
    """
    QuerySet for Invitation model.
    """

    def pending(self):
        return self.filter(
            status=InvitationStatus.PENDING,
        )

    def accepted(self):
        return self.filter(
            status=InvitationStatus.ACCEPTED,
        )

    def expired(self):
        return self.filter(
            expires_at__lt=timezone.now(),
        )

    def active(self):
        return self.pending().filter(
            expires_at__gte=timezone.now(),
        )

    def for_email(self, email):
        return self.filter(email__iexact=email)

    def for_organization(self, organization):
        return self.filter(
            organization=organization,
        )

    def for_inviter(self, user):
        return self.filter(
            invited_by=user,
        )

    def with_related(self):
        return self.select_related(
            "organization",
            "department",
            "team",
            "office",
            "role",
            "invited_by",
        )
