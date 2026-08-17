"""
Test suite for Core selectors.

This module contains tests for the read-only BaseSelector, verifying that
selectors only perform read operations and never mutate state.
"""

import pytest
from django.db import models

from apps.core.models.bases.entity import EntityModel
from apps.core.selectors.base import BaseSelector


@pytest.fixture
def test_selector_model():
    """Create a test entity model class for testing selectors."""

    class TestSelectorEntity(EntityModel):
        name = models.CharField(max_length=100)
        code = models.CharField(max_length=50, blank=True)

        class Meta:
            app_label = "core"
            db_table = "test_selector_entities"

    return TestSelectorEntity


@pytest.fixture
def test_selector(test_selector_model):
    """Create a selector for the test entity."""

    class TestSelector(BaseSelector):
        model = test_selector_model

        @classmethod
        def get_queryset(cls, *, request=None, view=None):
            return cls.model.objects.all()

    return TestSelector


@pytest.fixture
def seeded(test_selector, db):
    """Seed the test table with sample rows."""

    def _seed(*names):
        for name in names:
            test_selector.model.objects.create(name=name, code=name.upper())

    return _seed


class TestBaseSelector:
    """Tests for BaseSelector read operations."""

    def test_get_queryset_raises_not_implemented(self):
        """BaseSelector.get_queryset should raise NotImplementedError."""

        class BareSelector(BaseSelector):
            pass

        with pytest.raises(NotImplementedError):
            BareSelector.get_queryset()

    def test_all(self, test_selector, seeded, db):
        seeded("Alpha", "Beta", "Gamma")

        assert test_selector.all().count() == 3

    def test_get(self, test_selector, seeded, db):
        seeded("Alpha")

        entity = test_selector.get(name="Alpha")

        assert entity.name == "Alpha"

    def test_get_or_none(self, test_selector, seeded, db):
        seeded("Alpha")

        assert test_selector.get_or_none(name="Alpha") is not None
        assert test_selector.get_or_none(name="Missing") is None

    def test_filter(self, test_selector, seeded, db):
        seeded("Alpha", "Beta", "Gamma")

        assert test_selector.filter(name__startswith="A").count() == 1
        assert test_selector.filter(name__in=["Alpha", "Beta"]).count() == 2

    def test_exclude(self, test_selector, seeded, db):
        seeded("Alpha", "Beta", "Gamma")

        assert test_selector.exclude(name="Alpha").count() == 2

    def test_exists(self, test_selector, seeded, db):
        seeded("Alpha")

        assert test_selector.exists(name="Alpha") is True
        assert test_selector.exists(name="Missing") is False

    def test_first_and_last(self, test_selector, seeded, db):
        seeded("Alpha", "Beta")

        assert test_selector.first().name == "Alpha"
        assert test_selector.last().name == "Beta"

    def test_count(self, test_selector, seeded, db):
        seeded("Alpha", "Beta", "Gamma")

        assert test_selector.count() == 3

    def test_none(self, test_selector, seeded, db):
        seeded("Alpha")

        assert test_selector.none().count() == 0

    def test_values(self, test_selector, seeded, db):
        seeded("Alpha")

        rows = test_selector.values("name")

        assert list(rows) == [{"name": "Alpha"}]

    def test_values_list_flat(self, test_selector, seeded, db):
        seeded("Alpha", "Beta")

        names = list(test_selector.values_list("name", flat=True))

        assert names == ["Alpha", "Beta"]

    def test_in_bulk(self, test_selector, seeded, db):
        seeded("Alpha", "Beta")

        ids = list(test_selector.values_list("id", flat=True))

        bulk = test_selector.in_bulk(ids)

        assert len(bulk) == 2

    def test_select_related_returns_queryset(self, test_selector, seeded, db):
        seeded("Alpha")

        qs = test_selector.select_related()

        assert qs.count() == 1

    def test_prefetch_related_returns_queryset(self, test_selector, seeded, db):
        seeded("Alpha")

        qs = test_selector.prefetch_related()

        assert qs.count() == 1


class TestSelectorReadOnlyContract:
    """Selectors must never mutate state."""

    def test_selector_has_no_write_methods(self, test_selector):
        """Selectors should not expose create/update/delete methods."""
        for method in ("create", "update", "delete", "save", "bulk_create"):
            assert not hasattr(
                test_selector, method
            ), f"Selector should not expose write method '{method}'"

    def test_selector_does_not_mutate_on_read(self, test_selector, seeded, db):
        """Reading through a selector should not change the underlying rows."""
        seeded("Alpha", "Beta")

        before = set(test_selector.model.objects.values_list("name", flat=True))

        list(test_selector.all())
        test_selector.get(name="Alpha")
        test_selector.filter(name__startswith="A").count()

        after = set(test_selector.model.objects.values_list("name", flat=True))

        assert before == after
