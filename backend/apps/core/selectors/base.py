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
    def _resolve_queryset(cls, model=None):
        """
        Resolve the base queryset for a lookup.

        Selectors may pass an explicit model as the first positional argument
        (``cls.get(Model, id=...)``) or rely on the selector's own
        ``get_queryset()`` (``cls.get(id=...)``).
        """
        if model is not None:
            return model.objects.all()
        return cls.get_queryset()

    @classmethod
    def get(cls, model=None, **filters):
        return cls._resolve_queryset(model).get(
            **filters,
        )

    @classmethod
    def filter(cls, model=None, **filters):
        return cls._resolve_queryset(model).filter(
            **filters,
        )

    @classmethod
    def exclude(cls, model=None, **filters):
        return cls._resolve_queryset(model).exclude(
            **filters,
        )

    @classmethod
    def exists(cls, model=None, **filters):
        return cls.filter(
            model,
            **filters,
        ).exists()

    @classmethod
    def first(cls, model=None, **filters):
        return cls.filter(
            model,
            **filters,
        ).first()

    @classmethod
    def last(cls, model=None, **filters):
        return cls.filter(
            model,
            **filters,
        ).last()

    @classmethod
    def count(cls, model=None, **filters):
        return cls.filter(
            model,
            **filters,
        ).count()

    @classmethod
    def none(cls):
        return cls.get_queryset().none()

    @classmethod
    def get_or_none(cls, model=None, **filters):
        try:
            return cls.get(
                model,
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
