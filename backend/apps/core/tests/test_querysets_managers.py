from django.test import SimpleTestCase

from apps.core.models.managers import (
    ActiveManager,
    AllObjectsManager,
    AllPublishedManager,
    BaseManager,
    DeletedObjectsManager,
    OrganizationManager,
    PublishedManager,
    SoftDeleteManager,
)
from apps.core.models.querysets import (
    BaseQuerySet,
    OrganizationQuerySet,
    PublishableQuerySet,
    SoftDeleteQuerySet,
)
from apps.core.models.querysets.mixins import (
    LifecycleQuerySetMixin,
    OrderingQuerySetMixin,
    SearchQuerySetMixin,
    SoftDeleteQuerySetMixin,
)


class TestQuerySetAndManagerAPI(SimpleTestCase):
    """Meta-level checks for QuerySet and Manager public APIs.

    These tests do not hit the database. They assert that QuerySet mixins
    and concrete QuerySets offer the expected methods and that managers are
    thin (exist and subclass BaseManager).
    """

    def test_base_queryset_has_basic_methods(self):
        # Ensure BaseQuerySet provides ids, ordered, latest_first, oldest_first
        self.assertTrue(hasattr(BaseQuerySet, "ids"))
        self.assertTrue(hasattr(BaseQuerySet, "ordered"))
        self.assertTrue(hasattr(BaseQuerySet, "latest_first"))
        self.assertTrue(hasattr(BaseQuerySet, "oldest_first"))

        # BaseQuerySet deliberately does not implement lifecycle helpers
        # to avoid duplication with LifecycleQuerySetMixin
        self.assertFalse(hasattr(BaseQuerySet, "active"))
        self.assertFalse(hasattr(BaseQuerySet, "inactive"))

    def test_querysets_expose_expected_mixins_methods(self):
        # SoftDeleteQuerySet should provide alive/deleted/with_deleted
        self.assertTrue(hasattr(SoftDeleteQuerySet, "alive"))
        self.assertTrue(hasattr(SoftDeleteQuerySet, "deleted"))
        self.assertTrue(hasattr(SoftDeleteQuerySet, "with_deleted"))

        # PublishableQuerySet should provide published/unpublished/scheduled
        self.assertTrue(hasattr(PublishableQuerySet, "published"))
        self.assertTrue(hasattr(PublishableQuerySet, "unpublished"))
        self.assertTrue(hasattr(PublishableQuerySet, "scheduled"))

        # OrganizationQuerySet should provide organization() filter helper
        self.assertTrue(hasattr(OrganizationQuerySet, "organization"))

        # Mixins
        self.assertTrue(hasattr(OrderingQuerySetMixin, "ordered"))
        self.assertTrue(hasattr(SearchQuerySetMixin, "search"))
        self.assertTrue(hasattr(SoftDeleteQuerySetMixin, "alive"))
        self.assertTrue(hasattr(LifecycleQuerySetMixin, "active"))

    def test_managers_are_thin_and_exist(self):
        # Managers exist and are subclasses of BaseManager
        self.assertTrue(issubclass(SoftDeleteManager, BaseManager))
        self.assertTrue(hasattr(SoftDeleteManager, "get_queryset"))

        # Published managers
        self.assertTrue(issubclass(PublishedManager, BaseManager))
        self.assertTrue(hasattr(PublishedManager, "get_queryset"))
        self.assertTrue(hasattr(AllPublishedManager, "get_queryset"))

        # SoftDelete managers
        self.assertTrue(hasattr(AllObjectsManager, "get_queryset"))
        self.assertTrue(hasattr(DeletedObjectsManager, "get_queryset"))

        # Organization and Active managers
        self.assertTrue(issubclass(OrganizationManager, BaseManager))
        self.assertTrue(hasattr(OrganizationManager, "get_queryset"))
        self.assertTrue(hasattr(ActiveManager, "get_queryset"))
