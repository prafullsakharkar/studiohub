"""
Core test factories.

Provides factory classes for core models used in testing.
"""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.core.models.attachment import Attachment
from apps.core.models.tag import Tag


class TagFactory(DjangoModelFactory):
    """Factory for Tag model."""

    class Meta:
        model = Tag
        django_get_or_create = ("name",)

    name = factory.Sequence(lambda n: f"tag{n}")
    description = factory.Faker("text", max_nb_chars=200)
    color = factory.Faker("hex_color")
    is_system = False


class AttachmentFactory(DjangoModelFactory):
    """Factory for Attachment model."""

    class Meta:
        model = Attachment
        django_get_or_create = ("storage_key",)

    name = factory.Faker("file_name")
    description = factory.Faker("text", max_nb_chars=200)
    file_type = "document"
    mime_type = "application/pdf"
    file_size = 1024
    storage_key = factory.Faker("uuid4")
    is_public = False
