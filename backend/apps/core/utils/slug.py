"""
Slug utilities.
"""

from __future__ import annotations

from django.utils.text import slugify


def generate_slug(value: str) -> str:
    """
    Generate a slug.
    """
    return slugify(value)


def unique_slug(value: str, exists_callback) -> str:
    """
    Generate a unique slug using a callback that checks existence.
    """
    slug = generate_slug(value)
    candidate = slug
    counter = 1

    while exists_callback(candidate):
        candidate = f"{slug}-{counter}"
        counter += 1

    return candidate
