"""
A tiny registry that lets an app offer something to apps that must not import it.

Production shows delivery figures on its dashboard but may not import Deliveries
(docs/delivery-pipeline/CONTRACTS.md X-01, X-05). Deliveries registers a provider under a name at
startup (``AppConfig.ready``); Production asks for it by name and falls back to an empty answer when
nothing is registered. No domain logic lives here.
"""

from __future__ import annotations

from typing import Any

_providers: dict[str, Any] = {}


def register(name: str, provider: Any) -> None:
    """Offer ``provider`` under ``name`` (a later registration of the same name replaces it)."""
    _providers[name] = provider


def get(name: str) -> Any | None:
    """The provider registered under ``name``, or ``None`` when its app is not installed."""
    return _providers.get(name)


def unregister(name: str) -> None:
    """Remove a provider (for tests)."""
    _providers.pop(name, None)
