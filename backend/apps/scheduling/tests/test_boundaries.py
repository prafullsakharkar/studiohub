"""
App boundaries (docs/delivery-pipeline/DECISIONS.md, X-01): Production does not import Scheduling,
Scheduling does not import Deliveries or Publishing, and the capacity routes Production used to
serve now live under Scheduling.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest
from django.urls import NoReverseMatch, resolve, reverse

APPS = Path(__file__).resolve().parents[2]


def _imports(root: Path, forbidden: tuple[str, ...]) -> list[str]:
    offenders = []
    for path in root.rglob("*.py"):
        relative = path.relative_to(root).as_posix()
        if relative.startswith(("tests/", "migrations/")):
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            names = []
            if isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module]
            elif isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            offenders += [
                f"{relative}:{getattr(node, 'lineno', 0)} {name}"
                for name in names
                if name.startswith(forbidden)
            ]
    return offenders


def test_production_does_not_import_scheduling():
    assert _imports(APPS / "production", ("apps.scheduling",)) == []


def test_scheduling_does_not_import_deliveries_or_publishing():
    assert _imports(APPS / "scheduling", ("apps.deliveries", "apps.publishing")) == []


def test_identity_and_masterdata_import_none_of_the_three():
    forbidden = ("apps.scheduling", "apps.deliveries", "apps.publishing")

    assert _imports(APPS / "identity", forbidden) == []
    assert _imports(APPS / "masterdata", forbidden) == []


@pytest.mark.parametrize("name", ["capacity", "overbooking", "resolve-overbooking"])
def test_the_capacity_routes_are_served_by_scheduling(name):
    url = reverse(f"api:v1:scheduling:{name}")

    assert url.startswith("/api/v1/scheduling/")
    assert resolve(url).view_name == f"api:v1:scheduling:{name}"
    assert resolve(url).func.__module__.startswith("apps.scheduling.")


@pytest.mark.parametrize(
    "name", ["scheduling-capacity", "scheduling-overbooking", "scheduling-resolve-overbooking"]
)
def test_production_no_longer_names_them(name):
    with pytest.raises(NoReverseMatch):
        reverse(f"api:v1:production:{name}")
