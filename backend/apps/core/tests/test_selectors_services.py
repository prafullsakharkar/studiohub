from django.test import SimpleTestCase

from apps.core.selectors import AttachmentSelector, TagSelector
from apps.core.selectors.base import BaseSelector
from apps.core.services import (
    BaseService,
    CRUDService,
    EmailService,
    EventService,
    LifecycleService,
    NotificationService,
    SearchService,
    SoftDeleteService,
    StorageService,
)


class TestSelectorsAreReadOnly(SimpleTestCase):
    """Ensure selectors do not perform writes or publish events.

    These are meta-level checks that do not touch the database. They assert
    the selector classes only expose read/query methods and do not provide
    create/update/delete hooks — those belong to services.
    """

    def test_base_selector_has_query_methods_only(self):
        # Read helpers
        self.assertTrue(hasattr(BaseSelector, "get_queryset"))
        self.assertTrue(hasattr(BaseSelector, "get"))
        self.assertTrue(hasattr(BaseSelector, "filter"))
        self.assertTrue(hasattr(BaseSelector, "first"))
        self.assertTrue(hasattr(BaseSelector, "values"))

        # Should NOT expose mutation methods
        self.assertFalse(hasattr(BaseSelector, "create"))
        self.assertFalse(hasattr(BaseSelector, "update"))
        self.assertFalse(hasattr(BaseSelector, "delete"))
        self.assertFalse(hasattr(BaseSelector, "publish_event"))

    def test_concrete_selectors_do_not_mutate(self):
        for selector in (AttachmentSelector, TagSelector):
            self.assertFalse(hasattr(selector, "create"))
            self.assertFalse(hasattr(selector, "update"))
            self.assertFalse(hasattr(selector, "delete"))
            self.assertFalse(hasattr(selector, "publish_event"))


class TestServiceSurface(SimpleTestCase):
    """Sanity checks for core services public API shapes.

    These checks ensure core services provide generic infrastructure and do
    not themselves perform unexpected domain work. They do not execute
    side-effects.
    """

    def test_base_service_and_crud_exist(self):
        self.assertTrue(hasattr(BaseService, "_create"))
        self.assertTrue(hasattr(CRUDService, "create"))
        self.assertTrue(hasattr(CRUDService, "update"))
        self.assertTrue(hasattr(CRUDService, "delete"))

    def test_soft_delete_service_api(self):
        self.assertTrue(hasattr(SoftDeleteService, "delete"))
        self.assertTrue(hasattr(SoftDeleteService, "restore"))
        self.assertTrue(hasattr(SoftDeleteService, "hard_delete"))

    def test_lifecycle_and_search_services(self):
        self.assertTrue(hasattr(LifecycleService, "activate"))
        self.assertTrue(hasattr(LifecycleService, "archive"))
        self.assertTrue(hasattr(SearchService, "normalize"))

    def test_storage_and_email_and_notification_services(self):
        self.assertTrue(hasattr(StorageService, "exists"))
        self.assertTrue(hasattr(StorageService, "delete"))
        self.assertTrue(hasattr(EmailService, "send"))
        self.assertTrue(hasattr(NotificationService, "notify"))

    def test_event_service_after_delete_returns_instance(self):
        # The EventService lifecycle hooks should return the instance
        # to keep a consistent hook contract across services.
        class Dummy:
            pass

        dummy = Dummy()
        # The method should exist and return the provided object
        result = EventService.after_delete(dummy)
        self.assertIs(result, dummy)
