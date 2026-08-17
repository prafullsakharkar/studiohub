"""
Test suite for Core services.

This module contains unit and integration tests for the Core services,
including CRUDService, LifecycleService, and SoftDeleteService.
"""

import pytest
from django.db import models, transaction
from django.db.utils import IntegrityError

from apps.core.models.bases.audit import AuditModel
from apps.core.models.bases.entity import EntityModel
from apps.core.services.business import BusinessService
from apps.core.services.crud import CRUDService
from apps.core.services.lifecycle import LifecycleService
from apps.core.services.soft_delete import SoftDeleteService

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def test_entity_model():
    """Create a test entity model class for testing services."""

    class TestEntity(EntityModel, AuditModel):
        name = models.CharField(max_length=100)
        description = models.TextField(blank=True)

        class Meta:
            app_label = "core"
            db_table = "test_entities"

    return TestEntity


@pytest.fixture
def test_crud_service(test_entity_model):
    """Create a CRUD service for testing."""

    class TestCRUDService(CRUDService):
        model = test_entity_model

    return TestCRUDService


@pytest.fixture
def test_lifecycle_service(test_entity_model):
    """Create a Lifecycle service for testing."""

    class TestLifecycleService(LifecycleService):
        model = test_entity_model
        event_map = {
            LifecycleService.ACTIVATE: "test.entity.activated",
            LifecycleService.DEACTIVATE: "test.entity.deactivated",
            LifecycleService.ARCHIVE: "test.entity.archived",
            LifecycleService.DRAFT: "test.entity.drafted",
        }

    return TestLifecycleService


@pytest.fixture
def test_soft_delete_service(test_entity_model):
    """Create a SoftDelete service for testing."""

    class TestSoftDeleteService(SoftDeleteService):
        model = test_entity_model

    return TestSoftDeleteService


# ============================================================================
# CRUDService Tests
# ============================================================================


class TestCRUDService:
    """Tests for CRUDService."""

    def test_create(self, test_crud_service, db):
        """Test creating a new entity."""
        entity = test_crud_service.create(
            name="Test Entity", description="Test Description"
        )

        assert entity.id is not None
        assert entity.name == "Test Entity"
        assert entity.description == "Test Description"
        assert entity.created_by is None
        assert entity.updated_by is None

    def test_create_with_user(self, test_crud_service, user, db):
        """Test creating an entity with a user."""
        entity = test_crud_service.create(user=user, name="Test Entity")

        assert entity.created_by == user
        assert entity.updated_by == user

    def test_get(self, test_crud_service, db):
        """Test getting an entity by ID."""
        entity = test_crud_service.create(name="Test Entity")
        retrieved = test_crud_service.get(id=entity.id)

        assert retrieved.id == entity.id
        assert retrieved.name == "Test Entity"

    def test_get_not_found(self, test_crud_service, db):
        """Test getting a non-existent entity."""
        with pytest.raises(test_crud_service.model.DoesNotExist):
            test_crud_service.get(id=999999)

    def test_filter(self, test_crud_service, db):
        """Test filtering entities."""
        test_crud_service.create(name="Entity 1")
        test_crud_service.create(name="Entity 2")
        test_crud_service.create(name="Entity 3")

        entities = test_crud_service.filter(name__startswith="Entity")

        assert entities.count() == 3

    def test_update(self, test_crud_service, db):
        """Test updating an entity."""
        entity = test_crud_service.create(name="Original Name")

        updated = test_crud_service.update(entity, name="Updated Name")

        assert updated.name == "Updated Name"
        assert updated.id == entity.id

    def test_update_with_user(self, test_crud_service, user, db):
        """Test updating an entity with a user."""
        entity = test_crud_service.create(name="Original Name")

        updated = test_crud_service.update(entity, user=user, name="Updated Name")

        assert updated.updated_by == user

    def test_delete(self, test_crud_service, db):
        """Test deleting an entity."""
        entity = test_crud_service.create(name="Test Entity")

        test_crud_service.delete(entity)

        with pytest.raises(test_crud_service.model.DoesNotExist):
            test_crud_service.get(id=entity.id)

    def test_exists(self, test_crud_service, db):
        """Test checking if an entity exists."""
        entity = test_crud_service.create(name="Test Entity")

        assert test_crud_service.exists(id=entity.id)
        assert not test_crud_service.exists(id=999999)

    def test_count(self, test_crud_service, db):
        """Test counting entities."""
        test_crud_service.create(name="Entity 1")
        test_crud_service.create(name="Entity 2")
        test_crud_service.create(name="Entity 3")

        assert test_crud_service.count() == 3

    def test_in_bulk(self, test_crud_service, db):
        """Test bulk retrieval by ID."""
        entity1 = test_crud_service.create(name="Entity 1")
        entity2 = test_crud_service.create(name="Entity 2")
        entity3 = test_crud_service.create(name="Entity 3")

        bulk = test_crud_service.in_bulk([entity1.id, entity2.id])

        assert len(bulk) == 2
        assert bulk[entity1.id].id == entity1.id
        assert bulk[entity2.id].id == entity2.id

    def test_bulk_get(self, test_crud_service, db):
        """Test bulk retrieval by field."""
        entity1 = test_crud_service.create(name="Entity 1")
        entity2 = test_crud_service.create(name="Entity 2")

        bulk = test_crud_service.bulk_get([entity1.id, entity2.id])

        assert len(bulk) == 2

    def test_bulk_exists(self, test_crud_service, db):
        """Test bulk existence check."""
        entity1 = test_crud_service.create(name="Entity 1")
        entity2 = test_crud_service.create(name="Entity 2")

        # All supplied ids exist
        assert test_crud_service.bulk_exists([entity1.id, entity2.id]) is True

        # A missing id makes the check fail
        assert test_crud_service.bulk_exists([entity1.id, 999999]) is False

    def test_get_queryset(self, test_crud_service, db):
        """Test getting the queryset."""
        test_crud_service.create(name="Entity 1")
        test_crud_service.create(name="Entity 2")

        queryset = test_crud_service.get_queryset()

        assert queryset.count() == 2


# ============================================================================
# LifecycleService Tests
# ============================================================================


class TestLifecycleService:
    """Tests for LifecycleService."""

    def test_activate(self, test_lifecycle_service, db):
        """Test activating an entity."""
        entity = test_lifecycle_service.create(name="Test Entity", status="draft")

        activated = test_lifecycle_service.activate(entity)

        assert activated.status == "active"

    def test_deactivate(self, test_lifecycle_service, db):
        """Test deactivating an entity."""
        entity = test_lifecycle_service.create(name="Test Entity", status="active")

        deactivated = test_lifecycle_service.deactivate(entity)

        assert deactivated.status == "inactive"

    def test_archive(self, test_lifecycle_service, db):
        """Test archiving an entity."""
        entity = test_lifecycle_service.create(name="Test Entity", status="active")

        archived = test_lifecycle_service.archive(entity)

        assert archived.status == "archived"

    def test_draft(self, test_lifecycle_service, db):
        """Test setting an entity to draft status."""
        entity = test_lifecycle_service.create(name="Test Entity", status="active")

        drafted = test_lifecycle_service.draft(entity)

        assert drafted.status == "draft"

    def test_activate_with_user(self, test_lifecycle_service, user, db):
        """Test activating an entity with a user."""
        entity = test_lifecycle_service.create(name="Test Entity", status="draft")

        activated = test_lifecycle_service.activate(entity, user=user)

        assert activated.updated_by == user


# ============================================================================
# SoftDeleteService Tests
# ============================================================================


class TestSoftDeleteService:
    """Tests for SoftDeleteService."""

    def test_delete(self, test_soft_delete_service, db):
        """Test soft deleting an entity."""
        entity = test_soft_delete_service.create(name="Test Entity")

        test_soft_delete_service.delete(entity)

        # Entity should still exist in database
        assert test_soft_delete_service.model.objects.filter(id=entity.id).exists()
        # But should be marked as deleted
        assert entity.is_deleted is True

    def test_restore(self, test_soft_delete_service, db):
        """Test restoring a soft-deleted entity."""
        entity = test_soft_delete_service.create(name="Test Entity")
        test_soft_delete_service.delete(entity)

        restored = test_soft_delete_service.restore(entity)

        assert restored.is_deleted is False

    def test_hard_delete(self, test_soft_delete_service, db):
        """Test hard deleting an entity."""
        entity = test_soft_delete_service.create(name="Test Entity")

        test_soft_delete_service.hard_delete(entity)

        with pytest.raises(test_soft_delete_service.model.DoesNotExist):
            test_soft_delete_service.get(id=entity.id)


# ============================================================================
# BusinessService Compatibility Tests
# ============================================================================


class TestBusinessServiceCompatibility:
    """Tests for BusinessService backward compatibility."""

    def test_business_service_inherits_from_focused_services(self, test_entity_model):
        """Test that BusinessService inherits from focused services."""

        class TestBusinessService(BusinessService):
            model = test_entity_model

        # BusinessService should have methods from all parent classes
        assert hasattr(TestBusinessService, "create")
        assert hasattr(TestBusinessService, "update")
        assert hasattr(TestBusinessService, "delete")
        assert hasattr(TestBusinessService, "activate")
        assert hasattr(TestBusinessService, "deactivate")
        assert hasattr(TestBusinessService, "archive")
        assert hasattr(TestBusinessService, "draft")
        assert hasattr(TestBusinessService, "delete")  # soft delete
        assert hasattr(TestBusinessService, "restore")
        assert hasattr(TestBusinessService, "hard_delete")

    def test_business_service_deprecation_warning(self, test_entity_model):
        """Test that BusinessService has deprecation warning in docstring."""

        class TestBusinessService(BusinessService):
            model = test_entity_model

        assert "DEPRECATED" in BusinessService.__doc__


# ============================================================================
# Integration Tests
# ============================================================================


class TestServiceIntegration:
    """Integration tests for services working together."""

    def test_full_entity_lifecycle(self, test_crud_service, test_lifecycle_service, db):
        """Test a full entity lifecycle from creation to archive."""
        # Create
        entity = test_crud_service.create(name="Test Entity", status="draft")
        assert entity.status == "draft"

        # Activate
        entity = test_lifecycle_service.activate(entity)
        assert entity.status == "active"

        # Update
        entity = test_crud_service.update(entity, name="Updated Entity")
        assert entity.name == "Updated Entity"

        # Deactivate
        entity = test_lifecycle_service.deactivate(entity)
        assert entity.status == "inactive"

        # Archive
        entity = test_lifecycle_service.archive(entity)
        assert entity.status == "archived"

    def test_service_composition(
        self, test_crud_service, test_lifecycle_service, test_soft_delete_service, db
    ):
        """Test using multiple services together."""
        # Create with CRUD
        entity = test_crud_service.create(name="Test Entity")

        # Activate with Lifecycle
        entity = test_lifecycle_service.activate(entity)

        # Soft delete with SoftDelete
        test_soft_delete_service.delete(entity)

        # Verify entity is soft deleted
        assert test_crud_service.model.objects.filter(id=entity.id).exists()
        assert entity.is_deleted is True

        # Restore with SoftDelete
        entity = test_soft_delete_service.restore(entity)
        assert entity.is_deleted is False

        # Delete with CRUD
        test_crud_service.delete(entity)

        # Verify entity is hard deleted
        assert not test_crud_service.model.objects.filter(id=entity.id).exists()


# ============================================================================
# Transaction & Rollback Tests
# ============================================================================


class TestServiceTransactions:
    """Tests for transaction atomicity and rollback behavior."""

    def test_create_rolls_back_on_after_create_failure(self, test_crud_service, db):
        """A failure in after_create should roll back the created row."""

        class FailingService(test_crud_service.__class__):
            @classmethod
            def after_create(cls, instance, **kwargs):
                raise RuntimeError("boom")

        with pytest.raises(RuntimeError):
            FailingService.create(name="Should Rollback")

        assert FailingService.model.objects.count() == 0

    def test_update_rolls_back_on_after_update_failure(self, test_crud_service, db):
        """A failure in after_update should roll back the update."""

        class FailingService(test_crud_service.__class__):
            @classmethod
            def after_update(cls, instance, **kwargs):
                raise RuntimeError("boom")

        entity = test_crud_service.create(name="Original")

        with pytest.raises(RuntimeError):
            FailingService.update(entity, name="Changed")

        entity.refresh_from_db()
        assert entity.name == "Original"

    def test_delete_rolls_back_on_after_delete_failure(self, test_crud_service, db):
        """A failure in after_delete should roll back the delete."""

        class FailingService(test_crud_service.__class__):
            @classmethod
            def after_delete(cls, instance, **kwargs):
                raise RuntimeError("boom")

        entity = test_crud_service.create(name="Test Entity")

        with pytest.raises(RuntimeError):
            FailingService.delete(entity)

        assert test_crud_service.model.objects.filter(id=entity.id).exists()

    def test_soft_delete_rolls_back_on_publish_failure(self, test_soft_delete_service, db):
        """A failure while publishing should roll back the soft delete."""

        class FailingService(test_soft_delete_service.__class__):
            @classmethod
            def publish_event(cls, operation, **kwargs):
                raise RuntimeError("boom")

        entity = test_soft_delete_service.create(name="Test Entity")

        with pytest.raises(RuntimeError):
            FailingService.delete(entity)

        entity.refresh_from_db()
        assert entity.is_deleted is False


# ============================================================================
# Event Publishing & Cache Invalidation Hooks
# ============================================================================


class TestServiceHooks:
    """Tests for publish_event and invalidate_cache hooks."""

    def test_publish_event_is_noop_without_event_map(self, test_crud_service, db):
        """publish_event should be a safe no-op when no event is mapped."""
        entity = test_crud_service.create(name="Test Entity")

        # Should not raise even though no event_map is configured
        test_crud_service.publish_event("create", instance=entity)

    def test_publish_event_delegates_to_event_map(self, test_entity_model, db):
        """publish_event should publish the mapped event."""

        published = []

        class TestEvent:
            def __init__(self, **kwargs):
                published.append(kwargs)

        class EventService(test_crud_service.__class__):
            event_map = {"create": TestEvent}

        entity = EventService.create(name="Test Entity")

        assert len(published) == 1
        assert published[0]["instance"].id == entity.id

    def test_invalidate_cache_is_noop(self, test_crud_service, db):
        """invalidate_cache should be a safe no-op by default."""
        entity = test_crud_service.create(name="Test Entity")

        test_crud_service.invalidate_cache(entity)

    def test_business_service_soft_delete_publishes_and_invalidates(
        self, test_entity_model, db
    ):
        """BusinessService soft delete should call publish_event and invalidate_cache."""

        calls = []

        class TestBusinessService(BusinessService):
            model = test_entity_model

            @classmethod
            def publish_event(cls, operation, **kwargs):
                calls.append(("publish", operation))
                super().publish_event(operation, **kwargs)

            @classmethod
            def invalidate_cache(cls, instance):
                calls.append(("invalidate", instance.id))

        entity = TestBusinessService.create(name="Test Entity")

        TestBusinessService.delete(entity)

        assert ("publish", "delete") in calls
        assert ("invalidate", entity.id) in calls
        assert entity.is_deleted is True
