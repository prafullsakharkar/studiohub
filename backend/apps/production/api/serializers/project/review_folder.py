"""A project's review folder on studio storage (review-pipeline RP-18, C-RP-47; Q-RP-83, Q-RP-86)."""

from __future__ import annotations

from typing import Any

from apps.production.constants.permissions import ProjectPermissions
from apps.production.permissions.checks import has_permission_code
from apps.production.validators.review_source import clean_project_folder

REVIEW_FOLDER_FIELDS = ("review_source_root", "review_source_folder")


def can_see_review_folder(serializer: Any) -> bool:
    """Whether the caller may read the project's review folder: those who may change the project
    (Q-RP-86). Asked once per response, as the budget is; without a request the fields stay."""
    context = serializer.context
    if "_can_see_review_folder" not in context:
        request = context.get("request")
        context["_can_see_review_folder"] = request is None or has_permission_code(
            request, ProjectPermissions.UPDATE
        )
    return bool(context["_can_see_review_folder"])


# Comments, not docstrings: drf-spectacular takes a serializer's description from the first
# docstring in its MRO. This one leaves the folder out for callers who may not change the project.
class ReviewFolderGatedMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)  # pyright: ignore[reportAttributeAccessIssue]
        if not can_see_review_folder(self):
            for field in REVIEW_FOLDER_FIELDS:
                data.pop(field, None)
        return data


# The root must be listed in PUBLISHING_STORAGE_MOUNTS and the folder a safe relative folder.
class ProjectReviewFolderMixin:
    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)  # pyright: ignore[reportAttributeAccessIssue]
        return clean_project_folder(attrs, getattr(self, "instance", None))
