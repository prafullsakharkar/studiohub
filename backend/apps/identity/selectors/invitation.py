from django.db.models import QuerySet

from apps.identity.models import Invitation
from apps.identity.selectors.base import IdentityBaseSelector


class InvitationSelector(IdentityBaseSelector):
    """
    Read operations for Invitation.
    """

    model = Invitation

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls.model.objects.with_related()

    @classmethod
    def active(cls):
        return cls.get_queryset().active()

    @classmethod
    def pending(cls):
        return cls.get_queryset().pending()

    @classmethod
    def expired(cls):
        return cls.get_queryset().expired()

    @classmethod
    def for_email(cls, email):
        return cls.get_queryset().for_email(email)

    @classmethod
    def for_organization(cls, organization):
        return cls.get_queryset().for_organization(
            organization,
        )
