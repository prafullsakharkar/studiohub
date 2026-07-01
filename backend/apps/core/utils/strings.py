"""
String utility functions.
"""

from __future__ import annotations

import re


def normalize_spaces(value: str) -> str:
    """
    Collapse multiple spaces into one.
    """
    return re.sub(r"\s+", " ", value).strip()


def snake_to_title(value: str) -> str:
    """
    Convert snake_case to Title Case.
    """
    return value.replace("_", " ").title()


def title_to_snake(value: str) -> str:
    """
    Convert Title Case to snake_case.
    """
    return value.strip().replace(" ", "_").lower()


def truncate(value: str, length: int = 50) -> str:
    """
    Truncate a string.
    """
    if len(value) <= length:
        return value

    return value[: length - 3] + "..."
