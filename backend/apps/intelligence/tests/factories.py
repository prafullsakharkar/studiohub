"""
Intelligence test factories.
"""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.identity.tests.factories import UserFactory
from apps.intelligence.models import KnowledgeDocument, RecentSearch, SavedSearch
from apps.organization.tests.factories import OrganizationFactory


class KnowledgeDocumentFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for KnowledgeDocument model."""

    class Meta:
        model = KnowledgeDocument

    organization = factory.SubFactory(OrganizationFactory)
    title = factory.Sequence(lambda n: f"Knowledge Doc {n}")
    slug = factory.Sequence(lambda n: f"knowledge-doc-{n}")
    summary = factory.Faker("sentence")
    content_markdown = factory.Faker("paragraph")
    category = "pipeline"
    tags = factory.LazyFunction(list)
    author_name = factory.Faker("name")
    author_role = "Pipeline TD"
    version = "1.0"


class SavedSearchFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for SavedSearch model."""

    class Meta:
        model = SavedSearch

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Saved Search {n}")
    description = ""
    filters = factory.LazyFunction(dict)
    is_favorite = False


class RecentSearchFactory(DjangoModelFactory):  # pyright: ignore[reportMissingTypeArgument]
    """Factory for RecentSearch model."""

    class Meta:
        model = RecentSearch

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    query = factory.Sequence(lambda n: f"comp shots {n}")
    filters_snapshot = factory.LazyFunction(dict)
