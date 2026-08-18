"""
Core services.

Provides base service classes for domain applications.
"""

from __future__ import annotations

from apps.core.services.audit import AuditService
from apps.core.services.base import BaseService
from apps.core.services.bulk import BulkService
from apps.core.services.business import BusinessService
from apps.core.services.cache import CacheService
from apps.core.services.color import ColorService
from apps.core.services.crud import CRUDService
from apps.core.services.email import EmailService
from apps.core.services.event import EventService
from apps.core.services.lifecycle import LifecycleService
from apps.core.services.metadata import MetadataService
from apps.core.services.ordering import OrderingService
from apps.core.services.publishable import PublishableService
from apps.core.services.search import SearchService
from apps.core.services.slug import SlugService
from apps.core.services.soft_delete import SoftDeleteService
from apps.core.services.storage import StorageService

__all__ = [
    "AuditService",
    "BaseService",
    "BulkService",
    "BusinessService",
    "CacheService",
    "ColorService",
    "CRUDService",
    "EmailService",
    "EventService",
    "LifecycleService",
    "MetadataService",
    "OrderingService",
    "PublishableService",
    "SearchService",
    "SlugService",
    "SoftDeleteService",
    "StorageService",
]
