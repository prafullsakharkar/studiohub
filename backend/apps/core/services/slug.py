"""
Slug service.
"""

from __future__ import annotations

from django.utils.text import slugify

from .base import BaseService


class SlugService(BaseService):

    @classmethod
    def generate(
        cls,
        instance,
        *,
        source_field="name",
        target_field="slug",
    ):
        value = getattr(instance, source_field, "")

        setattr(
            instance,
            target_field,
            slugify(value),
        )

        return instance
