from apps.core.models.managers.base import (
    BaseManager,
)
from apps.organization.querysets.branding import (
    BrandingQuerySet,
)

BrandingManager = BaseManager.from_queryset(
    BrandingQuerySet,
)
