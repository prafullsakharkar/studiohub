"""
Intelligence test factories.
"""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.intelligence.models import KnowledgeDocument
from apps.organization.tests.factories import OrganizationFactory


class KnowledgeDocumentFactory(DjangoModelFactory):
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
