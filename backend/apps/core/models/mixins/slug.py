"""
Slug mixin.
"""

from __future__ import annotations

from apps.core.services import SlugService


class SlugMixin:
    """
    Slug helper methods.
    """

    def update_slug(self):
        return SlugService.generate(self)
