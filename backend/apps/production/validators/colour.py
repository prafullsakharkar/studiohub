"""
Colour names on project writes and review uploads (review-pipeline RP-15, C-RP-39, C-RP-40; Q-RP-71).

A name must be one the studio's OpenColorIO config knows: a scene-referred colour space (by name,
alias or role, any case), a view of its sRGB display, a look. What is stored is the config's own
spelling. A value already stored is not checked again when a write repeats it, so projects made
before RP-15 keep working; a new or changed value is.
"""

from __future__ import annotations

from typing import Any

from rest_framework.exceptions import ValidationError

from apps.production.transcode import colour

UNKNOWN = {
    "color_space": "The studio's colour config has no colour space named {value!r}.",
    "review_view": "The studio's colour config has no view named {value!r} for {display}.",
    "review_look": "The studio's colour config has no look named {value!r}.",
}
UNAVAILABLE = "The studio's colour config cannot be read, so colour settings cannot be changed now."

_RESOLVERS = {
    "color_space": colour.resolve_space,
    "review_view": colour.resolve_view,
    "review_look": colour.resolve_look,
}


def _resolve(field: str, value: str) -> str:
    try:
        resolved = _RESOLVERS[field](value)
        display = colour.display() if resolved is None else ""
    except colour.ColourUnavailable as error:
        raise ValidationError({field: [UNAVAILABLE]}) from error
    if resolved is None:
        raise ValidationError({field: [UNKNOWN[field].format(value=value, display=display)]})
    return resolved


def validate_project_colour(attrs: dict[str, Any], instance: Any = None) -> dict[str, Any]:
    """``attrs`` with each new colour name in the config's spelling; raises ``ValidationError``.

    Blank is allowed: no input space (nothing transformed), the default view, no look.
    """
    cleaned = dict(attrs)
    errors: dict[str, Any] = {}
    for field in _RESOLVERS:
        if field not in attrs:
            continue
        value = (attrs[field] or "").strip()
        if not value or (instance is not None and value == (getattr(instance, field, "") or "")):
            cleaned[field] = value
            continue
        try:
            resolved = _resolve(field, value)
        except ValidationError as error:
            errors.update(error.detail)  # pyright: ignore[reportCallIssue, reportArgumentType]
            continue
        # a blank view means the default view; naming the default explicitly is kept as named
        cleaned[field] = resolved
    if errors:
        raise ValidationError(errors)
    return cleaned


def validate_upload_colour(value: str) -> str:
    """The colour space a review upload names (C-RP-40), in the config's spelling; blank = none."""
    value = (value or "").strip()
    return _resolve("color_space", value) if value else ""
