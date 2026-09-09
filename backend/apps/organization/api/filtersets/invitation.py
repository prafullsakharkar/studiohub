"""Organization invitation filtersets."""

from __future__ import annotations

import django_filters

from apps.organization.models.invitation import Invitation


class InvitationFilterSet(django_filters.FilterSet):
    """FilterSet for Invitation model."""

    class Meta:
        model = Invitation
        fields = {
            "id": ["exact"],
            "status": ["exact"],
            "role": ["exact"],
        }
