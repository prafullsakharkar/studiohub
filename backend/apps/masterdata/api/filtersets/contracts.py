"""Filters for client and vendor contracts. ``status`` filters the derived API status."""

from __future__ import annotations

import django_filters
from django.utils import timezone

from apps.masterdata.models import EXPIRED, ClientContract, ContractStatus, VendorContract
from apps.masterdata.models.contract import active_now_q, elapsed_q

STATUS_CHOICES = [
    (ContractStatus.DRAFT.value, "Draft"),
    (ContractStatus.ACTIVE.value, "Active"),
    (EXPIRED, "Expired"),
    (ContractStatus.TERMINATED.value, "Terminated"),
]


class _ContractFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=STATUS_CHOICES, method="filter_status")

    def filter_status(self, queryset, name, value):
        """``Active`` and ``Expired`` are exact complements: both look at the end date."""
        today = timezone.localdate()
        if value == EXPIRED:
            return queryset.filter(elapsed_q(today))
        if value == ContractStatus.ACTIVE:
            return queryset.filter(active_now_q(today))
        return queryset.filter(status=value)


class ClientContractFilter(_ContractFilter):
    class Meta:
        model = ClientContract
        fields = ["client", "status", "type"]


class VendorContractFilter(_ContractFilter):
    class Meta:
        model = VendorContract
        fields = ["vendor", "status", "type"]
