"""
Admin policy for production models (DECISIONS D-24).

Production rows are archived through the API (soft delete, with status history and audit); the
admin's delete action would remove them for good, history with them. It is off for everyone,
superusers included.
"""

from __future__ import annotations

from typing import Any


class NoHardDeleteMixin:
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def get_actions(self, request: Any):
        actions = super().get_actions(request)  # pyright: ignore[reportAttributeAccessIssue]
        actions.pop("delete_selected", None)
        return actions
