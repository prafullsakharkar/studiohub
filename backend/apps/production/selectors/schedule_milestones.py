"""
A project's milestones as Production reads them, without importing Scheduling
(docs/delivery-pipeline/CONTRACTS.md X-01, X-05).

Scheduling registers a provider at startup; this module asks for it by name. When no provider is
registered the project has no milestones (an empty list, never an error).
"""

from __future__ import annotations

from typing import Any

from apps.core import providers

PROJECT_MILESTONES = "scheduling.project_milestones"


def project_milestones(project: Any) -> list[dict[str, Any]]:
    """The project's milestones (``id``, ``name``, ``date``, ``status``), or ``[]``."""
    provider = providers.get(PROJECT_MILESTONES)
    return provider.for_project(project) if provider is not None else []
