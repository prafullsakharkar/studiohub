"""
Dependency direction of the delivery pipeline apps (docs/delivery-pipeline/CONTRACTS.md X-01):

    production, identity, masterdata   import none of publishing, deliveries, scheduling
    publishing                         imports neither deliveries nor scheduling
    deliveries                         imports no scheduling
    scheduling                         imports neither publishing nor deliveries

An AST scan of every non-test module, so an import inside a function counts too. The three apps
read Production and Masterdata through their selectors, not by querying their models (a model may
be named in ``models/`` to declare a foreign key), and none of them has an organization foreign
key.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest
from django.apps import apps as django_apps

APPS = Path(__file__).resolve().parents[2]
THREE = ("publishing", "deliveries", "scheduling")


def _imported_modules(path: Path) -> list[tuple[int, str]]:
    found = []
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.append((node.lineno, node.module))
        elif isinstance(node, ast.Import):
            found.extend((node.lineno, alias.name) for alias in node.names)
    return found


def _modules(app: str, *, skip: tuple[str, ...] = ("tests/",)):
    root = APPS / app
    for path in sorted(root.rglob("*.py")):
        relative = path.relative_to(root).as_posix()
        if relative.startswith(skip) or "/tests/" in f"/{relative}":
            continue
        yield relative, path


def _offences(app: str, forbidden: tuple[str, ...], *, skip=("tests/",)) -> list[str]:
    prefixes = tuple(f"apps.{name}" for name in forbidden)
    return [
        f"apps/{app}/{relative}:{line} imports {module}"
        for relative, path in _modules(app, skip=skip)
        for line, module in _imported_modules(path)
        if module in prefixes or module.startswith(tuple(f"{p}." for p in prefixes))
    ]


@pytest.mark.parametrize("app", ["production", "identity", "masterdata"])
def test_the_foundation_apps_import_none_of_the_three(app):
    assert _offences(app, THREE) == []


def test_publishing_imports_neither_deliveries_nor_scheduling():
    assert _offences("publishing", ("deliveries", "scheduling")) == []


def test_deliveries_imports_no_scheduling():
    assert _offences("deliveries", ("scheduling",)) == []


def test_scheduling_imports_neither_publishing_nor_deliveries():
    assert _offences("scheduling", ("publishing", "deliveries")) == []


@pytest.mark.parametrize("app", THREE)
def test_the_three_apps_do_not_query_production_or_masterdata_models(app):
    """Reads go through ``apps.production.selectors`` and ``apps.masterdata.selectors`` (X-03, X-06)."""
    offences = [
        f"apps/{app}/{relative}:{line} imports {module}"
        for relative, path in _modules(app, skip=("tests/", "migrations/", "models/", "admin/"))
        for line, module in _imported_modules(path)
        if module.split(".")[:3]
        in (["apps", "production", "models"], ["apps", "masterdata", "models"])
    ]

    assert offences == []


def test_the_scan_sees_something():
    """A guard against the scan silently finding no files."""
    assert sum(1 for _ in _modules("scheduling")) > 20
    assert sum(1 for _ in _modules("production")) > 100


@pytest.mark.parametrize("app", THREE)
def test_no_model_of_the_three_apps_has_an_organization_field(app):
    config = django_apps.get_app_config(app)
    offences = [
        f"{model.__name__}.{field.name}"
        for model in config.get_models()
        for field in model._meta.get_fields()
        if "organization" in field.name.lower()
        or (
            field.is_relation
            and field.related_model is not None
            and "organization" in str(field.related_model).lower()
        )
    ]

    assert offences == []
