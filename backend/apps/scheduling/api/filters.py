"""Filter backends for the scheduling API."""

from __future__ import annotations

from rest_framework.filters import OrderingFilter

from apps.scheduling.selectors import ResourceSelector

#: columns whose order would reveal values the caller may not read (pay rates, D-21)
RATE_FIELDS = frozenset({"hourly_rate_usd"})


class RatesOrderingFilter(OrderingFilter):
    """
    ``?ordering=`` that ignores the pay rate for callers without ``schedule.view_rates``.

    Sorting by a hidden value discloses it as surely as printing it (SEC-SCH-01): a caller could
    rank everyone's rate and bisect it. Without the code the request falls back to the default
    order; with it, nothing changes.
    """

    def remove_invalid_fields(self, queryset, fields, view, request):
        allowed = super().remove_invalid_fields(queryset, fields, view, request)
        if ResourceSelector.holds_rates_code(getattr(request, "user", None)):
            return allowed
        return [term for term in allowed if term.lstrip("-") not in RATE_FIELDS]
