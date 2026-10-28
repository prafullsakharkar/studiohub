"""
Path rules for published files (docs/publishing/CONTRACTS.md DOM-PUB-03).

Pure functions, no ORM. A path is registered relative to a storage root. The server never
joins a value it was sent to a directory except through ``resolve_mount``.
"""

from __future__ import annotations

import os
import re
from pathlib import Path, PurePosixPath, PureWindowsPath

MAX_PATH_LENGTH = 1024
MAX_SEGMENT_LENGTH = 255

_FRAME_PATTERN = re.compile(r"%0?(\d*)d|(#+)")
_DRIVE = re.compile(r"^[A-Za-z]:")
# %2e (.), %2f (/), %5c (\): a tool that URL-decodes a stored path would otherwise traverse.
_PERCENT_ENCODED = re.compile(r"%(2e|2f|5c)", re.IGNORECASE)


class PathRuleError(ValueError):
    """The path breaks a rule of DOM-PUB-03. ``str(error)`` names the rule."""


def normalize_relative_path(value: str) -> str:
    """
    Return ``value`` when it is a clean POSIX relative path, else raise ``PathRuleError``.

    The value must equal its own normalized form: it is refused, never rewritten, so what is
    stored is what the pipeline tool sent.
    """
    if not isinstance(value, str) or not value:
        raise PathRuleError("A path is required.")
    if len(value) > MAX_PATH_LENGTH:
        raise PathRuleError(f"A path is at most {MAX_PATH_LENGTH} characters.")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise PathRuleError("A path cannot contain control characters.")
    if "\\" in value:
        raise PathRuleError("Use '/' as the separator; backslashes and UNC paths are refused.")
    if _PERCENT_ENCODED.search(value):
        raise PathRuleError("Percent-encoded dots and separators are refused.")
    if _DRIVE.match(value):
        raise PathRuleError("A drive letter is not a relative path.")
    if value.startswith(("/", "~")):
        raise PathRuleError("A path is relative to its storage root: no leading '/' or '~'.")
    if value.endswith("/"):
        raise PathRuleError("A path names a file, not a directory: no trailing '/'.")
    for segment in value.split("/"):
        if segment == "":
            raise PathRuleError("A path cannot contain an empty segment ('//').")
        if segment in {".", ".."}:
            raise PathRuleError("A path cannot contain '.' or '..' segments.")
        if len(segment) > MAX_SEGMENT_LENGTH:
            raise PathRuleError(f"A path segment is at most {MAX_SEGMENT_LENGTH} characters.")
    if PurePosixPath(value).as_posix() != value:
        raise PathRuleError("The path is not in normalized form.")
    return value


def is_sequence_pattern(value: str) -> bool:
    """True when the file name carries a frame pattern (``%04d`` or ``####``)."""
    return _FRAME_PATTERN.search(PurePosixPath(value).name) is not None


def frame_file_name(pattern_path: str, frame: int) -> str:
    """The relative path of one frame of a sequence pattern."""
    path = PurePosixPath(pattern_path)

    def fill(match: re.Match[str]) -> str:
        width = int(match.group(1)) if match.group(1) else len(match.group(2) or "")
        return str(frame).zfill(width) if width else str(frame)

    name = _FRAME_PATTERN.sub(fill, path.name, count=1)
    return str(path.with_name(name).as_posix())


def build_display_path(root_path: str, relative_path: str, *, windows: bool = False) -> str:
    """Join a root's display path and a relative path for showing to people. Never opened by the server."""
    if not root_path:
        return relative_path
    if windows:
        return str(PureWindowsPath(root_path).joinpath(*relative_path.split("/")))
    return str(PurePosixPath(root_path).joinpath(relative_path))


def resolve_mount(mount: str, relative_path: str) -> Path:
    """
    The real location of a registered path under a configured server mount.

    Refuses a result outside the mount, including through a symbolic link.
    """
    normalize_relative_path(relative_path)
    base = Path(os.path.realpath(mount))
    candidate = Path(os.path.realpath(base.joinpath(*relative_path.split("/"))))
    try:
        candidate.relative_to(base)
    except ValueError as error:
        raise PathRuleError("The path leaves its storage root.") from error
    return candidate
