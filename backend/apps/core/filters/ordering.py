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

    Unknown terms are dropped (DRF semantics: fall back to default ordering)
    instead of reaching ``order_by()`` raw, where a typo previously raised
    ``FieldError`` and surfaced as an unhandled 500.
    """

    field_class = _PermissiveOrderingField  # pyright: ignore[reportAssignmentType]

    def filter(self, qs, value):
        if not value:
            return qs
        model = getattr(qs, "model", None)
        if model is None:
            return qs
        valid = {
            field.name
            for field in model._meta.get_fields()
            if getattr(field, "concrete", False)
        } | {"pk"}
        # django-filter hands over a list of values (each possibly
        # comma-separated); normalize to individual `-field` terms.
        raw_terms: list[str] = []
        for item in value if isinstance(value, (list, tuple)) else [value]:
            raw_terms.extend(str(item).split(","))
        terms = [
            term.strip() for term in raw_terms if term.strip().lstrip("-") in valid
        ]
        if not terms:
            return qs
        return qs.order_by(*terms)


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
