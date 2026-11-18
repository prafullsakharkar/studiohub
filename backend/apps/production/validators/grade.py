"""
A shot's grade: its ASC CDL (review-pipeline RP-20, C-RP-52; Q-RP-92).

A grade is ``{"slope": [r, g, b], "offset": [r, g, b], "power": [r, g, b], "saturation": s}``. Typed
on the shot or read from a client's ``.cc``, ``.ccc`` or ``.cdl`` file, it is checked the same way
and stored the same way: floats rounded to six places (what CDL files carry), so a grade read again
from the same file is equal to the stored one and no copy counts as made with another grade.
"""

from __future__ import annotations

import math
from typing import Any

#: field -> (lowest, highest, whether the lowest itself is allowed)
BOUNDS: dict[str, tuple[float, float, bool]] = {
    "slope": (0.0, 10.0, True),
    "offset": (-1.0, 1.0, True),
    "power": (0.0, 10.0, False),
    "saturation": (0.0, 10.0, True),
}
CHANNELS = ("slope", "offset", "power")
FIELDS = (*CHANNELS, "saturation")
PLACES = 6


class GradeError(ValueError):
    """A grade that cannot be stored; ``field`` names the part at fault."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.message = message


def _number(field: str, value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise GradeError(field, f"{field} must be numbers.")
    number = float(value)
    if not math.isfinite(number):
        raise GradeError(field, f"{field} must be finite numbers.")
    low, high, low_allowed = BOUNDS[field]
    if number > high or number < low or (number == low and not low_allowed):
        above = "from" if low_allowed else "above"
        raise GradeError(field, f"{field} must be {above} {low:g} up to {high:g}.")
    return round(number, PLACES) + 0.0  # + 0.0 turns -0.0 into 0.0


def clean_grade(value: Any) -> dict[str, Any] | None:
    """``value`` as a stored grade, or ``None`` (no grade); raises ``GradeError``."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise GradeError("grade", "A grade is an object with slope, offset, power and saturation.")
    unknown = sorted(set(value) - set(FIELDS))
    if unknown:
        raise GradeError(unknown[0], f"A grade has no field {unknown[0]!r}.")
    missing = [field for field in FIELDS if field not in value]
    if missing:
        raise GradeError(missing[0], f"{missing[0]} is required.")
    grade: dict[str, Any] = {}
    for field in CHANNELS:
        numbers = value[field]
        if not isinstance(numbers, list | tuple) or len(numbers) != 3:
            raise GradeError(field, f"{field} must be three numbers: red, green and blue.")
        grade[field] = [_number(field, n) for n in numbers]
    grade["saturation"] = _number("saturation", value["saturation"])
    return grade
