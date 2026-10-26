"""
Codes that are numbered, not typed (DECISIONS D-23).

``allocate_codes`` hands out the next codes of a series (``SH0010``, ``SH0020``, ...) for one
project. It locks the project row and reads the highest number in use, soft-deleted rows
included, so two requests numbering the same project never get the same code. The lock lasts
to the end of the surrounding transaction: call it in the transaction that creates the rows,
or the guarantee is gone (the database's unique constraint still stops a duplicate, but a
loser then fails instead of waiting).

``episode_code`` derives an episode code from season and episode numbers.
"""

from __future__ import annotations

import re
from typing import Any

from django.db import transaction
from rest_framework.exceptions import ValidationError

DEFAULT_STEP = 10
DEFAULT_PADDING = 4
MAX_COUNT = 1000

_PREFIX = re.compile(r"^[A-Z][A-Z0-9_-]{0,19}$")


def episode_code(season: int, episode: int) -> str | None:
    """
    ``EP101`` for season 1 episode 1, as before; ``EP12034`` for season 12 episode 34.

    Seasons up to 9 with episodes up to 99 keep the short form (5 characters); anything larger
    uses ``EP{season:02d}{episode:03d}`` (7 characters), so no two pairs share a code. Numbers
    outside 0..99 and 0..999 derive nothing: the caller must type a code.
    """
    if not (0 <= season <= 99 and 0 <= episode <= 999):
        return None
    if season <= 9 and episode <= 99:
        return f"EP{season}{episode:02d}"
    return f"EP{season:02d}{episode:03d}"


def allocate_codes(
    project: Any,
    model: type,
    prefix: str,
    count: int,
    *,
    step: int = DEFAULT_STEP,
    padding: int = DEFAULT_PADDING,
) -> list[str]:
    """
    The next ``count`` codes of ``prefix`` for ``project``, ``step`` apart.

    The first one is the next multiple of ``step`` above the highest number already used with
    that prefix (any case, soft-deleted rows included): with ``SH0010`` and ``SH0020`` in use,
    ``allocate_codes(project, Shot, "SH", 2)`` gives ``SH0030`` and ``SH0040``.
    """
    prefix = (prefix or "").strip().upper()
    if not _PREFIX.match(prefix):
        raise ValidationError(
            {
                "code_prefix": [
                    "Use letters, digits, '_' or '-', starting with a letter (20 at most)."
                ]
            }
        )
    if not 1 <= count <= MAX_COUNT:
        raise ValidationError({"count": [f"Ask for between 1 and {MAX_COUNT} codes."]})
    if step < 1 or not 1 <= padding <= 10:
        raise ValidationError({"step": ["The step must be at least 1 and the padding 1 to 10."]})

    from apps.production.models import Project

    with transaction.atomic():
        Project.objects.select_for_update().get(pk=project.pk)
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
        highest = 0
        used = model.all_objects.filter(project=project, code__istartswith=prefix)  # pyright: ignore[reportAttributeAccessIssue]
        for code in used.values_list("code", flat=True):
            match = pattern.match(code)
            if match:
                highest = max(highest, int(match.group(1)))
        first = (highest // step + 1) * step
        return [f"{prefix}{first + index * step:0{padding}d}" for index in range(count)]
