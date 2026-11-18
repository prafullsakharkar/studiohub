"""
Path rules for published files (docs/publishing/CONTRACTS.md DOM-PUB-03).

Pure functions, no ORM. A path is registered relative to a storage root. The server never
joins a value it was sent to a directory except through ``resolve_mount``.

The rules themselves live in ``apps.core.utils.paths`` (review-pipeline RP-17), so the media worker
reads registered files through the same checks; they are re-exported here for publishing's callers.
Only the display join, which is about how people see a root, stays in publishing.
"""

from __future__ import annotations

from pathlib import PurePosixPath, PureWindowsPath

from apps.core.utils.paths import (
    MAX_PATH_LENGTH,
    MAX_SEGMENT_LENGTH,
    PathRuleError,
    frame_file_name,
    is_sequence_pattern,
    normalize_relative_path,
    resolve_mount,
)

__all__ = [
    "MAX_PATH_LENGTH",
    "MAX_SEGMENT_LENGTH",
    "PathRuleError",
    "build_display_path",
    "frame_file_name",
    "is_sequence_pattern",
    "normalize_relative_path",
    "resolve_mount",
]


def build_display_path(root_path: str, relative_path: str, *, windows: bool = False) -> str:
    """Join a root's display path and a relative path for showing to people. Never opened by the server."""
    if not root_path:
        return relative_path
    if windows:
        return str(PureWindowsPath(root_path).joinpath(*relative_path.split("/")))
    return str(PurePosixPath(root_path).joinpath(relative_path))
