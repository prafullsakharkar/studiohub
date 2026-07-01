"""
Base validator classes.
"""

from __future__ import annotations

from typing import Any


class BaseValidator:
    """
    Base validator interface.
    """

    message = "Validation failed."

    code = "invalid"

    def __call__(self, value: Any):
        self.validate(value)

    def validate(self, value: Any):
        raise NotImplementedError
