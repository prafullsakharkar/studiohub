"""A project's colour settings on writes (review-pipeline RP-15, C-RP-39; Q-RP-71)."""

from __future__ import annotations

from typing import Any

from apps.production.validators.colour import validate_project_colour


# No class docstring: drf-spectacular would show it as every project write's description.
class ProjectColourMixin:
    # ``color_space``, ``review_view`` and ``review_look`` must be names the studio's config knows.

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)  # pyright: ignore[reportAttributeAccessIssue]
        return validate_project_colour(attrs, getattr(self, "instance", None))
