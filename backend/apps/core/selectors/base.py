from __future__ import annotations

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import QuerySet


class BaseSelector:
    """
    Base class for read-only selectors.
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
        Return the base queryset.

        Applications should override.
        """
        raise NotImplementedError

    @classmethod
    def get(cls, **filters):
        return cls.queryset().get(**filters)

    @classmethod
    def filter(cls, **filters):
        return cls.queryset().filter(**filters)

    @classmethod
    def exists(cls, **filters):
        return cls.queryset().filter(**filters).exists()

    @classmethod
    def first(cls, **filters):
        return cls.queryset().filter(**filters).first()

    @classmethod
    def last(cls, **filters):
        return cls.filter(**filters).last()

    @classmethod
    def count(cls, **filters):
        return cls.queryset().filter(**filters).count()

    @classmethod
    def get_or_none(cls, **filters):
        try:
            return cls.get(**filters)
        except ObjectDoesNotExist:
            return None
