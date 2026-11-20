"""The project's slate line (review pipeline RP-25, C-RP-59)."""

from django.core.exceptions import ValidationError


def validate_single_line(value: str) -> None:
    """One line of printable text: a newline, a tab or another control character is refused."""
    if any(not ch.isprintable() for ch in value or ""):
        raise ValidationError("One line of text, without tabs or line breaks.")
