from __future__ import annotations

from apps.core.api.exceptions.api import ConflictException


class MasterdataConflict(ConflictException):
    """409 that reports a specific ``error.code`` (API-MD-04).

    The core handler derives ``error.code`` from ``exc.code`` or the class
    ``default_code``. DRF keeps a per-instance code only on the detail object,
    so the code is also stored on the exception itself.

    Codes: ``conflict``, ``system_row_protected``, ``has_dependants``,
    ``invalid_transition``, ``not_soft_deleted``.
    """

    def __init__(self, detail: str, code: str = "conflict") -> None:
        super().__init__(detail, code)
        self.code = code
