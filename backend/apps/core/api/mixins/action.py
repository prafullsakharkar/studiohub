"""
Action mixin.
"""
from __future__ import annotations


class ActionMixin:
    """
    Hook for additional action handling.
    """

    def perform_action(self, action):
        return super().perform_action(action)
