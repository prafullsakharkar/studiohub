from django.core.exceptions import ObjectDoesNotExist


class BaseSelector:
    """
    Base class for read-only selectors.
    """

    model = None

    @classmethod
    def queryset(cls):
        return cls.model.objects.all()

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
    def count(cls, **filters):
        return cls.queryset().filter(**filters).count()

    @classmethod
    def get_or_none(cls, **filters):
        try:
            return cls.get(**filters)
        except ObjectDoesNotExist:
            return None
