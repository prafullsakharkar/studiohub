from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.base import OrganizationEntityQuerySet

OrganizationEntityManager = BaseManager.from_queryset(OrganizationEntityQuerySet)
