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
    def all(
        cls,
        *,
        request=None,
        view=None,
    ):
        return cls.get_queryset(
            request=request,
            view=view,
        )

    @classmethod
    def get(cls, **filters):
        return cls.get_queryset().get(
            **filters,
        )

    @classmethod
    def filter(cls, **filters):
        return cls.get_queryset().filter(
            **filters,
        )

    @classmethod
    def exclude(cls, **filters):
        return cls.get_queryset().exclude(
            **filters,
        )

    @classmethod
    def exists(cls, **filters):
        return cls.filter(
            **filters,
        ).exists()

    @classmethod
    def first(cls, **filters):
        return cls.filter(
            **filters,
        ).first()

    @classmethod
    def last(cls, **filters):
        return cls.filter(
            **filters,
        ).last()

    @classmethod
    def count(cls, **filters):
        return cls.filter(
            **filters,
        ).count()

    @classmethod
    def none(cls):
        return cls.get_queryset().none()

    @classmethod
    def get_or_none(cls, **filters):
        try:
            return cls.get(
                **filters,
            )
        except ObjectDoesNotExist:
            return None

    @classmethod
    def values(cls, *fields):
        return cls.get_queryset().values(*fields)

    @classmethod
    def values_list(
        cls,
        *fields,
        flat=False,
    ):
        return cls.get_queryset().values_list(
            *fields,
            flat=flat,
        )

    @classmethod
    def in_bulk(
        cls,
        ids,
        *,
        field_name="id",
    ):
        return cls.get_queryset().in_bulk(
            ids,
            field_name=field_name,
        )

    @classmethod
    def select_related(
        cls,
        *fields,
    ):
        return cls.get_queryset().select_related(
            *fields,
        )

    @classmethod
    def prefetch_related(
        cls,
        *fields,
    ):
        return cls.get_queryset().prefetch_related(
            *fields,
        )
