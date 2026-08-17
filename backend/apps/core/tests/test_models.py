"""
Tests for Core model foundation.

Tests the reusable base models and mixins provided by the Core app.
"""

import pytest
from django.db import models

from apps.core.models.bases import (
    AuditModel,
    ColorModel,
    EntityModel,
    LifecycleModel,
    MetadataModel,
    NamedEntityModel,
    OrderableModel,
    PublishableModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.core.models.mixins import (
    AuditMixin,
    ColorMixin,
    MetadataMixin,
    OrderingMixin,
    OwnershipMixin,
    PublishableMixin,
    SearchMixin,
    SlugMixin,
    SoftDeleteMixin,
)

# ============================================================================
# UUIDModel Tests
# ============================================================================


@pytest.mark.django_db
class TestUUIDModel:
    """Tests for UUIDModel."""

    def test_uuid_primary_key(self):
        """Test that UUIDModel uses UUID as primary key."""

        class TestModel(UUIDModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert obj.id is not None
        assert isinstance(obj.id, str)  # UUID is stored as char in DB

    def test_uuid_is_automatically_generated(self):
        """Test that UUID is automatically generated on creation."""

        class TestModel(UUIDModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert obj.id is not None
        assert len(obj.id) == 36  # UUID format: 8-4-4-4-12


# ============================================================================
# TimeStampedModel Tests
# ============================================================================


@pytest.mark.django_db
class TestTimeStampedModel:
    """Tests for TimeStampedModel."""

    def test_created_at_field(self):
        """Test that created_at field exists and is set on creation."""

        class TestModel(TimeStampedModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "created_at")
        assert obj.created_at is not None

    def test_updated_at_field(self):
        """Test that updated_at field exists and is updated on save."""

        class TestModel(TimeStampedModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        original_created_at = obj.created_at
        original_updated_at = obj.updated_at

        # Wait a moment to ensure time difference
        import time

        time.sleep(0.1)

        obj.name = "updated"
        obj.save()

        assert obj.updated_at > original_updated_at
        assert obj.created_at == original_created_at


# ============================================================================
# SoftDeleteModel Tests
# ============================================================================


@pytest.mark.django_db
class TestSoftDeleteModel:
    """Tests for SoftDeleteModel."""

    def test_is_deleted_field(self):
        """Test that is_deleted field exists."""

        class TestModel(SoftDeleteModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "is_deleted")
        assert obj.is_deleted is False

    def test_status_field(self):
        """Test that status field exists."""

        class TestModel(SoftDeleteModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "status")

    def test_deleted_at_field(self):
        """Test that deleted_at field exists."""

        class TestModel(SoftDeleteModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "deleted_at")
        assert obj.deleted_at is None


# ============================================================================
# AuditModel Tests
# ============================================================================


@pytest.mark.django_db
class TestAuditModel:
    """Tests for AuditModel."""

    def test_created_by_field(self):
        """Test that created_by field exists."""

        class TestModel(AuditModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "created_by")

    def test_updated_by_field(self):
        """Test that updated_by field exists."""

        class TestModel(AuditModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "updated_by")

    def test_deleted_by_field(self):
        """Test that deleted_by field exists."""

        class TestModel(AuditModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "deleted_by")


# ============================================================================
# OrderableModel Tests
# ============================================================================


@pytest.mark.django_db
class TestOrderableModel:
    """Tests for OrderableModel."""

    def test_order_field(self):
        """Test that order field exists."""

        class TestModel(OrderableModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "order")
        assert obj.order == 0  # Default value


# ============================================================================
# PublishableModel Tests
# ============================================================================


@pytest.mark.django_db
class TestPublishableModel:
    """Tests for PublishableModel."""

    def test_is_published_field(self):
        """Test that is_published field exists."""

        class TestModel(PublishableModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "is_published")
        assert obj.is_published is False  # Default value

    def test_published_at_field(self):
        """Test that published_at field exists."""

        class TestModel(PublishableModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "published_at")
        assert obj.published_at is None


# ============================================================================
# MetadataModel Tests
# ============================================================================


@pytest.mark.django_db
class TestMetadataModel:
    """Tests for MetadataModel."""

    def test_metadata_field(self):
        """Test that metadata field exists."""

        class TestModel(MetadataModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "metadata")
        assert obj.metadata == {}  # Default value


# ============================================================================
# ColorModel Tests
# ============================================================================


@pytest.mark.django_db
class TestColorModel:
    """Tests for ColorModel."""

    def test_color_field(self):
        """Test that color field exists."""

        class TestModel(ColorModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "color")
        assert obj.color == ""  # Default value


# ============================================================================
# LifecycleModel Tests
# ============================================================================


@pytest.mark.django_db
class TestLifecycleModel:
    """Tests for LifecycleModel."""

    def test_status_field(self):
        """Test that status field exists with lifecycle choices."""

        class TestModel(LifecycleModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "status")
        assert obj.status == "active"  # Default value

    def test_is_active_property(self):
        """Test is_active property."""

        class TestModel(LifecycleModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert obj.is_active is True

    def test_is_inactive_property(self):
        """Test is_inactive property."""

        class TestModel(LifecycleModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test", status="inactive")
        assert obj.is_inactive is True

    def test_is_archived_property(self):
        """Test is_archived property."""

        class TestModel(LifecycleModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test", status="archived")
        assert obj.is_archived is True

    def test_is_draft_property(self):
        """Test is_draft property."""

        class TestModel(LifecycleModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test", status="draft")
        assert obj.is_draft is True


# ============================================================================
# EntityModel Tests
# ============================================================================


@pytest.mark.django_db
class TestEntityModel:
    """Tests for EntityModel."""

    def test_entity_model_includes_all_capabilities(self):
        """Test that EntityModel includes all expected capabilities."""

        class TestModel(EntityModel, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")

        # Check all capabilities
        assert hasattr(obj, "id")  # UUIDModel
        assert hasattr(obj, "created_at")  # TimeStampedModel
        assert hasattr(obj, "updated_at")  # TimeStampedModel
        assert hasattr(obj, "is_deleted")  # SoftDeleteModel
        assert hasattr(obj, "created_by")  # AuditModel
        assert hasattr(obj, "updated_by")  # AuditModel
        assert hasattr(obj, "metadata")  # MetadataModel


# ============================================================================
# NamedEntityModel Tests
# ============================================================================


@pytest.mark.django_db
class TestNamedEntityModel:
    """Tests for NamedEntityModel."""

    def test_name_field(self):
        """Test that name field exists."""

        class TestModel(NamedEntityModel, models.Model):
            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test")
        assert hasattr(obj, "name")
        assert obj.name == "test"

    def test_description_field(self):
        """Test that description field exists."""

        class TestModel(NamedEntityModel, models.Model):
            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="test", description="A test model")
        assert hasattr(obj, "description")
        assert obj.description == "A test model"

    def test_slug_field(self):
        """Test that slug field exists."""

        class TestModel(NamedEntityModel, models.Model):
            class Meta:
                app_label = "core"

        obj = TestModel.objects.create(name="Test Model")
        assert hasattr(obj, "slug")
        assert obj.slug == "test-model"


# ============================================================================
# Mixin Tests
# ============================================================================


@pytest.mark.django_db
class TestSlugMixin:
    """Tests for SlugMixin."""

    def test_update_slug_method(self):
        """Test that update_slug method exists."""

        class TestModel(SlugMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="Test Name")
        assert hasattr(obj, "update_slug")
        assert callable(obj.update_slug)


@pytest.mark.django_db
class TestSoftDeleteMixin:
    """Tests for SoftDeleteMixin."""

    def test_soft_delete_method(self):
        """Test that soft_delete method exists."""

        class TestModel(SoftDeleteMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "soft_delete")
        assert callable(obj.soft_delete)

    def test_restore_method(self):
        """Test that restore method exists."""

        class TestModel(SoftDeleteMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "restore")
        assert callable(obj.restore)

    def test_hard_delete_method(self):
        """Test that hard_delete method exists."""

        class TestModel(SoftDeleteMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "hard_delete")
        assert callable(obj.hard_delete)


@pytest.mark.django_db
class TestAuditMixin:
    """Tests for AuditMixin."""

    def test_mark_created_method(self):
        """Test that mark_created method exists."""

        class TestModel(AuditMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "mark_created")
        assert callable(obj.mark_created)

    def test_mark_updated_method(self):
        """Test that mark_updated method exists."""

        class TestModel(AuditMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "mark_updated")
        assert callable(obj.mark_updated)

    def test_mark_deleted_method(self):
        """Test that mark_deleted method exists."""

        class TestModel(AuditMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "mark_deleted")
        assert callable(obj.mark_deleted)


@pytest.mark.django_db
class TestOwnershipMixin:
    """Tests for OwnershipMixin."""

    def test_is_owner_method(self):
        """Test that is_owner method exists."""

        class TestModel(OwnershipMixin, models.Model):
            name = models.CharField(max_length=100)
            owner = models.ForeignKey(
                "identity.User",
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
            )

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "is_owner")
        assert callable(obj.is_owner)


@pytest.mark.django_db
class TestPublishableMixin:
    """Tests for PublishableMixin."""

    def test_publish_method(self):
        """Test that publish method exists."""

        class TestModel(PublishableMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "publish")
        assert callable(obj.publish)

    def test_unpublish_method(self):
        """Test that unpublish method exists."""

        class TestModel(PublishableMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "unpublish")
        assert callable(obj.unpublish)


@pytest.mark.django_db
class TestSearchMixin:
    """Tests for SearchMixin."""

    def test_normalize_search_method(self):
        """Test that normalize_search method exists."""

        class TestModel(SearchMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        assert hasattr(TestModel, "normalize_search")
        assert callable(TestModel.normalize_search)


@pytest.mark.django_db
class TestColorMixin:
    """Tests for ColorMixin."""

    def test_random_color_method(self):
        """Test that random_color method exists."""

        class TestModel(ColorMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        assert hasattr(TestModel, "random_color")
        assert callable(TestModel.random_color)

    def test_normalize_color_method(self):
        """Test that normalize_color method exists."""

        class TestModel(ColorMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        assert hasattr(TestModel, "normalize_color")
        assert callable(TestModel.normalize_color)


@pytest.mark.django_db
class TestMetadataMixin:
    """Tests for MetadataMixin."""

    def test_get_meta_method(self):
        """Test that get_meta method exists."""

        class TestModel(MetadataMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "get_meta")
        assert callable(obj.get_meta)

    def test_set_meta_method(self):
        """Test that set_meta method exists."""

        class TestModel(MetadataMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "set_meta")
        assert callable(obj.set_meta)

    def test_remove_meta_method(self):
        """Test that remove_meta method exists."""

        class TestModel(MetadataMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "remove_meta")
        assert callable(obj.remove_meta)

    def test_clear_meta_method(self):
        """Test that clear_meta method exists."""

        class TestModel(MetadataMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "clear_meta")
        assert callable(obj.clear_meta)


@pytest.mark.django_db
class TestOrderingMixin:
    """Tests for OrderingMixin."""

    def test_move_up_method(self):
        """Test that move_up method exists."""

        class TestModel(OrderingMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "move_up")
        assert callable(obj.move_up)

    def test_move_down_method(self):
        """Test that move_down method exists."""

        class TestModel(OrderingMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "move_down")
        assert callable(obj.move_down)

    def test_move_to_method(self):
        """Test that move_to method exists."""

        class TestModel(OrderingMixin, models.Model):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = "core"

        obj = TestModel(name="test")
        assert hasattr(obj, "move_to")
        assert callable(obj.move_to)
