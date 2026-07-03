from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.organization_settings import (
    OrganizationSettingsQuerySet,
)

OrganizationSettingsManager = BaseManager.from_queryset(
    OrganizationSettingsQuerySet,
)
