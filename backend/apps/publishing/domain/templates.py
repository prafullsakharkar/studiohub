"""
The path template language (review-pipeline RP-4, C-RP-18). Pure functions, no ORM.

A pattern is a relative path with tokens in braces:

* ``{project}``, ``{episode}``, ``{sequence}``, ``{shot}``, ``{asset}``, ``{asset_type}``,
  ``{task}``, ``{department}``: codes, filled from the version;
* ``{version}``: the version's index; ``{version:03}`` pads it to three digits;
* ``{ext}``: the file type's extension, without its dot;
* ``{frame}``: the frame pattern of a sequence, ``%04d``; ``{frame:6}`` sets the width;
* ``{name}``: free text chosen by the tool, one run of letters, digits, ``_``, ``-`` and ``.``.

``render`` fills every token but ``{name}``, which it leaves in place. ``matches`` says whether a
registered path is the rendered pattern with ``{name}`` replaced by an allowed value.
"""

from __future__ import annotations

import re
from collections.abc import Mapping

from apps.publishing.domain.paths import PathRuleError, normalize_relative_path

CODE_TOKENS = (
    "project",
    "episode",
    "sequence",
    "shot",
    "asset",
    "asset_type",
    "task",
    "department",
)
TOKENS = frozenset({*CODE_TOKENS, "version", "ext", "frame", "name"})
#: tokens that take a width after a colon
WIDTH_TOKENS = frozenset({"version", "frame"})

NAME = "{name}"
_NAME_VALUE = r"[A-Za-z0-9_.\-]+"
_TOKEN = re.compile(r"\{([a-z_]+)(?::(\d{1,2}))?\}")
_DEFAULT_FRAME_WIDTH = 4
_MAX_WIDTH = 10

#: what a pattern is rendered with when it is saved, to check that it can make a valid path
SAMPLE_VALUES: Mapping[str, str | int] = {
    **{token: token.upper() for token in CODE_TOKENS},
    "version": 1,
    "ext": "exr",
}


class TemplateError(ValueError):
    """The pattern breaks a rule of the language, or a token has no value. ``str()`` says which."""


def tokens(pattern: str) -> list[str]:
    """The tokens of ``pattern``, in order. Raises ``TemplateError`` for a malformed pattern."""
    if not isinstance(pattern, str) or not pattern.strip():
        raise TemplateError("A pattern is required.")
    found: list[str] = []
    for match in _TOKEN.finditer(pattern):
        name, width = match.group(1), match.group(2)
        if name not in TOKENS:
            raise TemplateError(f"Unknown token {{{name}}}.")
        if width is not None:
            if name not in WIDTH_TOKENS:
                raise TemplateError(f"{{{name}}} takes no width.")
            if not 1 <= int(width) <= _MAX_WIDTH:
                raise TemplateError(f"A width is between 1 and {_MAX_WIDTH}.")
        found.append(name)
    if "{" in _TOKEN.sub("", pattern) or "}" in _TOKEN.sub("", pattern):
        raise TemplateError("Braces are only used around a token, such as {shot}.")
    return found


def render(pattern: str, values: Mapping[str, str | int | None]) -> str:
    """
    ``pattern`` with every token but ``{name}`` filled from ``values``.

    A token whose value is missing or blank raises ``TemplateError`` naming it. ``{frame}`` needs
    no value.
    """
    tokens(pattern)

    def fill(match: re.Match[str]) -> str:
        name, width = match.group(1), match.group(2)
        if name == "name":
            return NAME
        if name == "frame":
            return f"%0{int(width) if width else _DEFAULT_FRAME_WIDTH}d"
        value = values.get(name)
        if value is None or str(value).strip() == "":
            raise TemplateError(f"This version has no value for {{{name}}}.")
        if name == "version":
            return str(int(value)).zfill(int(width)) if width else str(int(value))
        return str(value).strip()

    return _TOKEN.sub(fill, pattern)


def check_pattern(pattern: str) -> None:
    """Raise ``TemplateError`` unless the pattern, rendered with sample values, is a valid path."""
    sample = render(pattern, SAMPLE_VALUES).replace(NAME, "name")
    try:
        normalize_relative_path(sample)
    except PathRuleError as error:
        raise TemplateError(f"The pattern does not make a valid path: {error}") from error


def matches(rendered: str, path: str) -> bool:
    """Whether ``path`` is ``rendered`` with each ``{name}`` replaced by an allowed value."""
    parts = rendered.split(NAME)
    regex = _NAME_VALUE.join(re.escape(part) for part in parts)
    return re.fullmatch(regex, path) is not None


__all__ = [
    "NAME",
    "TOKENS",
    "TemplateError",
    "check_pattern",
    "matches",
    "render",
    "tokens",
]
