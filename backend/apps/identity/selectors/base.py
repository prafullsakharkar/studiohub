from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector


class IdentityBaseSelector(BaseSelector):
    """
    Base selector for Identity bounded context.
    """

    model = None

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Default queryset.

        Individual selectors should override when
        select_related/prefetch_related are needed.
        """
        return cls.model.objects.all()

    @classmethod
    def by_uuid(cls, uuid):
        return cls.get_queryset().filter(
            uuid=uuid,
        )

    @classmethod
    def by_name(cls, name):
        return cls.get_queryset().by_name(name)

    @classmethod
    def by_code(cls, code):
        return cls.get_queryset().by_code(code)

    @classmethod
    def active(cls):
        return cls.get_queryset().active()
