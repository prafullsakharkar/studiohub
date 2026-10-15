"""
Masterdata domain event subscriptions.

Provision-on-create was removed with the organization lifecycle
(org-removal B3): there is no tenant to provision. ``register_events`` is
kept as a no-op so event autodiscovery keeps working.
"""

from __future__ import annotations


def register_events() -> None:
    return None
