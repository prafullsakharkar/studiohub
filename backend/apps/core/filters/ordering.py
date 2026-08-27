import django_filters
from django import forms


class _PermissiveOrderingField(forms.ChoiceField):
    """
    ChoiceField that accepts any ordering parameter.

    ``django_filters.OrderingFilter`` is a ``ChoiceFilter``; with no explicit
    ``fields``/``choices`` it would reject every value. Accepting arbitrary
    values (with ``-`` prefix support) lets the API order by any model field
    while the parent ``filter()`` passes unknown parameters straight through
    to ``order_by()`` (``param_map`` defaults to the parameter itself).
    """

    def __init__(self, *, choices=(), null_label=None, **kwargs):
        # ``forms.ChoiceField`` does not accept ``null_label`` (it is a
        # django-filter concept injected via ``OrderingFilter.extra``), so it
        # must not be forwarded to ``super().__init__`` — but it is kept as an
        # attribute because drf-spectacular introspects ``field.null_label``
        # when generating OpenAPI schemas for ordering filters.
        self.null_label = null_label
        super().__init__(choices=choices, **kwargs)

    def valid_value(self, value):
        """Accept any value, including comma-separated multi-ordering."""
        return True


class AnyFieldOrderingFilter(django_filters.OrderingFilter):
    """
    Ordering filter that accepts any model field name.
    """

    field_class = _PermissiveOrderingField


class OrderingFilterMixin(django_filters.FilterSet):
    """
    Mixin providing an ``ordering`` query parameter.

    Declared filters on a plain Python mixin are invisible to django-filter's
    metaclass (``get_declared_filters`` only inspects class attributes and
    bases that are themselves FilterSets). Subclassing ``FilterSet`` with an
    abstract ``Meta`` makes the declared ``ordering`` filter inherited by every
    concrete FilterSet that includes this mixin.
    """

    ordering = AnyFieldOrderingFilter()

    class Meta:
        abstract = True
