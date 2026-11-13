"""
Deployment checks of the production app (``manage.py check --deploy``).
"""

from __future__ import annotations

from django.conf import settings
from django.core.checks import Tags, Warning, register


@register(Tags.security, deploy=True)
def review_media_needs_nginx_ranges(app_configs, **kwargs):
    """
    With review media on and no ``MEDIA_ACCEL_PREFIX``, Django streams every movie itself: each seek
    holds an application worker for the length of the answer (review-pipeline RP-5, ADR-0040).
    """

    if not getattr(settings, "REVIEW_MEDIA_ENABLED", False) or getattr(
        settings, "MEDIA_ACCEL_PREFIX", ""
    ):
        return []

    return [
        Warning(
            "REVIEW_MEDIA_ENABLED is on but MEDIA_ACCEL_PREFIX is empty: Django streams review movies itself.",
            hint="Set MEDIA_ACCEL_PREFIX=/_protected_media so nginx serves them (and answers seeks).",
            id="production.W001",
        )
    ]
