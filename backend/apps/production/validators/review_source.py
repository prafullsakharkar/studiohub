"""
A project's review folder on studio storage (review-pipeline RP-18, C-RP-47 to C-RP-49; ADR-0043).

A version still in review can have its copy read from a render named by path, but only a path under
the folder its project declares: one storage root (listed in ``PUBLISHING_STORAGE_MOUNTS``) and one
relative folder on it (Q-RP-83). The request checks it, the worker checks it again before reading,
and a remake checks it once more, so a changed or cleared folder stops older copies being remade.
Refusals never name a directory (Q-RP-86).
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from rest_framework.exceptions import ValidationError

from apps.core.utils.paths import (
    MAX_PATH_LENGTH,
    PathRuleError,
    is_sequence_pattern,
    normalize_relative_path,
)

#: the folder is stored in a 512-character column; a path under it is at most ``MAX_PATH_LENGTH``
FOLDER_MAX_LENGTH = 512

NO_FOLDER = "This project has no review folder on studio storage."
ROOT_NOT_READ = "The server does not read the storage root of this project's review folder."


def root_listed(root: str) -> bool:
    """Whether the servers read storage root ``root`` (``PUBLISHING_STORAGE_MOUNTS``, Q-RP-78)."""
    return bool(root) and root.upper() in settings.PUBLISHING_STORAGE_MOUNTS


def clean_project_folder(attrs: dict[str, Any], instance: Any | None = None) -> dict[str, Any]:
    """Check ``review_source_root`` and ``review_source_folder`` on a project write (C-RP-47).

    Both blank switches it off. A root must be listed when it is written; a stored root that is no
    longer listed survives other writes. The folder is a relative folder on the root, never the whole
    root, and not a frame pattern.
    """
    if "review_source_root" not in attrs and "review_source_folder" not in attrs:
        return attrs
    root = attrs.get("review_source_root", getattr(instance, "review_source_root", "") or "")
    folder = attrs.get("review_source_folder", getattr(instance, "review_source_folder", "") or "")
    root = (root or "").strip().upper()
    folder = (folder or "").strip().strip("/")
    errors: dict[str, list[str]] = {}
    if not root and not folder:
        attrs["review_source_root"], attrs["review_source_folder"] = "", ""
        return attrs
    if not root:
        errors["review_source_root"] = ["A review folder needs its storage root."]
    elif "review_source_root" in attrs and not root_listed(root):
        errors["review_source_root"] = ["The server does not read this storage root."]
    if not folder:
        errors["review_source_folder"] = [
            "Name a folder on the root; the whole root cannot be a review folder."
        ]
    else:
        try:
            folder = normalize_relative_path(folder)
        except PathRuleError as error:
            errors["review_source_folder"] = [str(error)]
        else:
            if len(folder) > FOLDER_MAX_LENGTH:
                errors["review_source_folder"] = [
                    f"A folder is at most {FOLDER_MAX_LENGTH} characters."
                ]
            elif is_sequence_pattern(folder):
                errors["review_source_folder"] = ["A folder is not a frame pattern."]
    if errors:
        raise ValidationError(errors)
    attrs["review_source_root"], attrs["review_source_folder"] = root, folder
    return attrs


def project_folder(project: Any) -> tuple[str, str] | None:
    """The project's review folder as ``(root, folder)``, or ``None`` when it has none."""
    root = (getattr(project, "review_source_root", "") or "").upper()
    folder = getattr(project, "review_source_folder", "") or ""
    return (root, folder) if root and folder else None


def inside_folder(folder: str, path: str) -> bool:
    """Whether ``path`` (relative to the root) lies under ``folder``, segment by segment."""
    return bool(folder) and path.startswith(f"{folder}/") and len(path) > len(folder) + 1


def full_path(project: Any, path: Any) -> str:
    """The path on the root of a render named relative to the project's folder (C-RP-48).

    A 400 on ``path``, one sentence that never names a directory, when the project has no folder,
    its root is no longer read, or the path is unsafe or too long.
    """
    where = project_folder(project)
    if where is None:
        raise ValidationError({"path": [NO_FOLDER]})
    root, folder = where
    if not root_listed(root):
        raise ValidationError({"path": [ROOT_NOT_READ]})
    try:
        relative = normalize_relative_path(path)
    except PathRuleError as error:
        raise ValidationError({"path": [str(error)]}) from error
    joined = f"{folder}/{relative}"
    if len(joined) > MAX_PATH_LENGTH:
        raise ValidationError(
            {
                "path": [
                    f"With the project's folder, a path is at most {MAX_PATH_LENGTH} characters."
                ]
            }
        )
    return joined


def path_still_readable(project: Any, root: str, path: str) -> bool:
    """Whether a copy read by path can still be read: the same root, still listed, and the path
    still under the project's current folder (C-RP-48, C-RP-49)."""
    where = project_folder(project)
    if where is None or not root_listed(root):
        return False
    return where[0] == root.upper() and inside_folder(where[1], path)


__all__ = [
    "FOLDER_MAX_LENGTH",
    "NO_FOLDER",
    "ROOT_NOT_READ",
    "clean_project_folder",
    "full_path",
    "inside_folder",
    "path_still_readable",
    "project_folder",
    "root_listed",
]
