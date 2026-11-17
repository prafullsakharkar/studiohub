"""
Checks of the production app: deployment (``manage.py check --deploy``) and the colour config.
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


@register()
def review_media_colour_config(app_configs, **kwargs):
    """
    The OpenColorIO config review copies are made with must load (review-pipeline RP-15, ADR-0041).
    Without it copies are made as before RP-15 and colour settings cannot be changed.
    """

    if not getattr(settings, "REVIEW_MEDIA_ENABLED", False):
        return []
    from apps.production.transcode import colour

    try:
        colour.config()
    except colour.ColourUnavailable as error:
        return [
            Warning(
                f"REVIEW_MEDIA_OCIO_CONFIG cannot be loaded: {error}",
                hint="Name a built-in config (ocio://...) or a config.ocio the web and media worker can read.",
                id="production.W002",
            )
        ]
    return []
