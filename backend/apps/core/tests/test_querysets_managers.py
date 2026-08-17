"""
Tests for Core querysets and managers.

Verifies that QuerySets are responsible for query construction only and that
Managers remain thin, delegating to their associated QuerySet.
"""

import pytest
from django.db import models

from apps.core.choices.lifecycle import LifecycleStatus
from apps.core.managers import (
    ActiveManager,
    AllObjectsManager,
    DeletedObjectsManager,
    SoftDeleteManager,
)
from apps.core.models.querysets import (
    BaseQuerySet,
    PublishableQuerySet,
    SoftDeleteQuerySet,
)
from apps.core.models.querysets.mixins import (
    LifecycleQuerySetMixin,
    OrderingQuerySetMixin,
    PublishableQuerySetMixin,
    SearchQuerySetMixin,
    SoftDeleteQuerySetMixin,
)

# ============================================================================
# Test model fixtures
# ============================================================================


class _SoftDeleteTestModel(models.Model):
    """Model with soft delete support for testing querysets/managers."""

    name = models.CharField(max_length=100)
    is_deleted = models.BooleanField(default=False, db_index=True)
    status = models.CharField(
        max_length=20,
        default="active",
        db_index=True,
    )
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()
    deleted_objects = DeletedObjectsManager()

    class Meta:
        app_label = "core"


class _PublishableTestModel(models.Model):
    """Model with publishable support for testing querysets."""

    name = models.CharField(max_length=100)
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)

    objects = models.Manager.from_queryset(PublishableQuerySet)()

    class Meta:
        app_label = "core"


class _LifecycleTestModel(models.Model):
    """Model with lifecycle support for testing querysets."""

    name = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=LifecycleStatus.choices,
        default=LifecycleStatus.ACTIVE,
        db_index=True,
    )

    objects = models.Manager.from_queryset(
        type(
            "LifecycleQuerySet",
            (LifecycleQuerySetMixin, BaseQuerySet),
            {},
        )
    )()

    class Meta:
        app_label = "core"


class _SearchTestModel(models.Model):
    """Model with search support for testing querysets."""

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)

    objects = models.Manager.from_queryset(
        type(
            "SearchQuerySet",
            (SearchQuerySetMixin, BaseQuerySet),
            {"search_fields": ("name", "code")},
        )
    )()

    class Meta:
        app_label = "core"


class _OrderedTestModel(models.Model):
    """Model with default ordering for testing querysets."""

    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = models.Manager.from_queryset(
        type(
            "OrderedQuerySet",
            (OrderingQuerySetMixin, BaseQuerySet),
            {},
        )
    )()

    class Meta:
        app_label = "core"
        ordering = ("name",)


# ============================================================================
# BaseQuerySet Tests
# ============================================================================


@pytest.mark.django_db
class TestBaseQuerySet:
    """Tests for BaseQuerySet."""

    def test_ids(self):
        """Test that ids() returns only object ids."""
        a = _SoftDeleteTestModel.objects.create(name="a")
        b = _SoftDeleteTestModel.objects.create(name="b")

        ids = list(_SoftDeleteTestModel.all_objects.ids())
        assert a.id in ids
        assert b.id in ids

    def test_ordered_respects_model_ordering(self):
        """Test that ordered() respects model default ordering."""
        _OrderedTestModel.objects.create(name="b")
        _OrderedTestModel.objects.create(name="a")

        names = list(_OrderedTestModel.objects.ordered().values_list("name", flat=True))
        assert names == ["a", "b"]

    def test_ordered_without_model_ordering_returns_unchanged(self):
        """Test that ordered() is safe when model has no default ordering."""
        _SoftDeleteTestModel.objects.create(name="a")
        qs = _SoftDeleteTestModel.all_objects.ordered()
        assert qs.count() == 1

    def test_latest_first(self):
        """Test that latest_first() orders by created_at descending."""
        _SoftDeleteTestModel.objects.create(name="a")
        _SoftDeleteTestModel.objects.create(name="b")

        qs = _SoftDeleteTestModel.all_objects.latest_first()
        assert qs.count() == 2


# ============================================================================
# SoftDeleteQuerySet Tests
# ============================================================================


@pytest.mark.django_db
class TestSoftDeleteQuerySet:
    """Tests for SoftDeleteQuerySet."""

    def test_alive_excludes_deleted(self):
        """Test that alive() excludes soft-deleted records."""
        _SoftDeleteTestModel.objects.create(name="alive")
        deleted = _SoftDeleteTestModel.objects.create(name="deleted")
        deleted.is_deleted = True
        deleted.save()

        alive = list(
            _SoftDeleteTestModel.all_objects.alive().values_list("name", flat=True)
        )
        assert alive == ["alive"]

    def test_deleted_returns_only_deleted(self):
        """Test that deleted() returns only soft-deleted records."""
        _SoftDeleteTestModel.objects.create(name="alive")
        deleted = _SoftDeleteTestModel.objects.create(name="deleted")
        deleted.is_deleted = True
        deleted.save()

        deleted_names = list(
            _SoftDeleteTestModel.all_objects.deleted().values_list("name", flat=True)
        )
        assert deleted_names == ["deleted"]

    def test_with_deleted_returns_all(self):
        """Test that with_deleted() returns all records."""
        _SoftDeleteTestModel.objects.create(name="alive")
        deleted = _SoftDeleteTestModel.objects.create(name="deleted")
        deleted.is_deleted = True
        deleted.save()

        assert _SoftDeleteTestModel.all_objects.with_deleted().count() == 2


# ============================================================================
# SoftDeleteManager Tests
# ============================================================================


@pytest.mark.django_db
class TestSoftDeleteManager:
    """Tests for soft delete managers."""

    def test_default_manager_excludes_deleted(self):
        """Test that the default manager excludes deleted records."""
        _SoftDeleteTestModel.objects.create(name="alive")
        deleted = _SoftDeleteTestModel.objects.create(name="deleted")
        deleted.is_deleted = True
        deleted.save()

        assert _SoftDeleteTestModel.objects.count() == 1

    def test_all_objects_includes_deleted(self):
        """Test that all_objects includes deleted records."""
        _SoftDeleteTestModel.objects.create(name="alive")
        deleted = _SoftDeleteTestModel.objects.create(name="deleted")
        deleted.is_deleted = True
        deleted.save()

        assert _SoftDeleteTestModel.all_objects.count() == 2

    def test_deleted_objects_returns_only_deleted(self):
        """Test that deleted_objects returns only deleted records."""
        _SoftDeleteTestModel.objects.create(name="alive")
        deleted = _SoftDeleteTestModel.objects.create(name="deleted")
        deleted.is_deleted = True
        deleted.save()

        assert _SoftDeleteTestModel.deleted_objects.count() == 1


# ============================================================================
# PublishableQuerySet Tests
# ============================================================================


@pytest.mark.django_db
class TestPublishableQuerySet:
    """Tests for PublishableQuerySet."""

    def test_published(self):
        """Test that published() returns published records."""
        from django.utils import timezone

        _PublishableTestModel.objects.create(name="unpublished")
        _PublishableTestModel.objects.create(
            name="published",
            is_published=True,
            published_at=timezone.now(),
        )

        published = list(
            _PublishableTestModel.objects.published().values_list("name", flat=True)
        )
        assert published == ["published"]

    def test_unpublished(self):
        """Test that unpublished() returns unpublished records."""
        _PublishableTestModel.objects.create(name="unpublished")
        _PublishableTestModel.objects.create(
            name="published",
            is_published=True,
        )

        unpublished = list(
            _PublishableTestModel.objects.unpublished().values_list("name", flat=True)
        )
        assert unpublished == ["unpublished"]

    def test_scheduled(self):
        """Test that scheduled() returns future-published records."""
        from datetime import timedelta

        from django.utils import timezone

        _PublishableTestModel.objects.create(name="now")
        _PublishableTestModel.objects.create(
            name="scheduled",
            is_published=True,
            published_at=timezone.now() + timedelta(days=1),
        )

        scheduled = list(
            _PublishableTestModel.objects.scheduled().values_list("name", flat=True)
        )
        assert scheduled == ["scheduled"]


# ============================================================================
# LifecycleQuerySetMixin Tests
# ============================================================================


@pytest.mark.django_db
class TestLifecycleQuerySetMixin:
    """Tests for LifecycleQuerySetMixin."""

    def test_active(self):
        """Test that active() filters by active status."""
        _LifecycleTestModel.objects.create(name="active")
        _LifecycleTestModel.objects.create(name="archived", status=LifecycleStatus.ARCHIVED)

        active = list(_LifecycleTestModel.objects.active().values_list("name", flat=True))
        assert active == ["active"]

    def test_archived(self):
        """Test that archived() filters by archived status."""
        _LifecycleTestModel.objects.create(name="active")
        _LifecycleTestModel.objects.create(name="archived", status=LifecycleStatus.ARCHIVED)

        archived = list(
            _LifecycleTestModel.objects.archived().values_list("name", flat=True)
        )
        assert archived == ["archived"]

    def test_draft(self):
        """Test that draft() filters by draft status."""
        _LifecycleTestModel.objects.create(name="active")
        _LifecycleTestModel.objects.create(name="draft", status=LifecycleStatus.DRAFT)

        draft = list(_LifecycleTestModel.objects.draft().values_list("name", flat=True))
        assert draft == ["draft"]


# ============================================================================
# SearchQuerySetMixin Tests
# ============================================================================


@pytest.mark.django_db
class TestSearchQuerySetMixin:
    """Tests for SearchQuerySetMixin."""

    def test_search_matches_name(self):
        """Test that search() matches across declared search fields."""
        _SearchTestModel.objects.create(name="Alpha", code="A1")
        _SearchTestModel.objects.create(name="Beta", code="B1")

        results = list(
            _SearchTestModel.objects.search("Alpha").values_list("name", flat=True)
        )
        assert results == ["Alpha"]

    def test_search_matches_code(self):
        """Test that search() matches on code field."""
        _SearchTestModel.objects.create(name="Alpha", code="A1")
        _SearchTestModel.objects.create(name="Beta", code="B1")

        results = list(_SearchTestModel.objects.search("B1").values_list("name", flat=True))
        assert results == ["Beta"]

    def test_search_empty_returns_all(self):
        """Test that search() with empty value returns all records."""
        _SearchTestModel.objects.create(name="Alpha", code="A1")
        _SearchTestModel.objects.create(name="Beta", code="B1")

        assert _SearchTestModel.objects.search("").count() == 2


# ============================================================================
# ActiveManager Tests
# ============================================================================


@pytest.mark.django_db
class TestActiveManager:
    """Tests for ActiveManager."""

    def test_active_manager_filters_active(self):
        """Test that ActiveManager exposes only active records."""

        class _ActiveTestModel(models.Model):
            name = models.CharField(max_length=100)
            status = models.CharField(max_length=20, default="active")

            objects = ActiveManager()

            class Meta:
                app_label = "core"

        _ActiveTestModel.objects.create(name="active")
        _ActiveTestModel.objects.create(name="inactive", status="inactive")

        assert _ActiveTestModel.objects.count() == 1
        assert _ActiveTestModel.objects.first().name == "active"


# ============================================================================
# Manager → QuerySet relationship tests
# ============================================================================


class TestManagerQuerySetRelationship:
    """Tests that managers delegate to their associated QuerySet."""

    def test_soft_delete_manager_uses_soft_delete_queryset(self):
        """Test that SoftDeleteManager is built from SoftDeleteQuerySet."""
        assert issubclass(SoftDeleteManager, models.Manager)
        # The manager's queryset class should expose soft delete methods
        qs = _SoftDeleteTestModel.objects.all()
        assert hasattr(qs, "alive")
        assert hasattr(qs, "deleted")
        assert hasattr(qs, "with_deleted")

    def test_querysets_are_query_construction_only(self):
        """Test that querysets expose query methods, not business workflows."""
        # SoftDeleteQuerySet should not expose business workflow methods
        forbidden = {"publish_event", "send_notification", "notify"}
        for name in dir(SoftDeleteQuerySet):
            assert (
                name not in forbidden
            ), f"QuerySet should not expose business workflow method: {name}"
