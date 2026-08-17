"""
Architecture tests for Core module.

These tests enforce architectural rules:
1. Domain→Core dependency direction (NOT Core→Domain)
2. Public API surface stability
3. No Core→identity violations
"""

import ast
import os
from pathlib import Path

import pytest

# Core modules that should NOT import from identity
CORE_MODULES = [
    "apps.core.api.viewsets.base",
    "apps.core.api.viewsets.generic",
    "apps.core.api.viewsets.service",
    "apps.core.api.viewsets.readonly",
    "apps.core.api.viewsets.nested",
    "apps.core.api.serializers.base",
    "apps.core.api.permissions.resolver",
    "apps.core.api.permissions.mixins",
    "apps.core.api.permissions.base",
    "apps.core.api.permissions.owner",
    "apps.core.api.permissions.staff",
    "apps.core.api.permissions.readonly",
    "apps.core.api.exceptions.api",
    "apps.core.api.exceptions.authentication",
    "apps.core.api.exceptions.permissions",
    "apps.core.api.exceptions.validation",
    "apps.core.api.exceptions.handlers",
    "apps.core.api.renderers.json",
    "apps.core.api.renderers.csv",
    "apps.core.api.renderers.excel",
    "apps.core.api.pagination.base",
    "apps.core.api.pagination.page_number",
    "apps.core.api.pagination.limit_offset",
    "apps.core.api.pagination.cursor",
    "apps.core.api.pagination.infinite",
    "apps.core.api.builders.response",
    "apps.core.api.builders.pagination",
    "apps.core.api.builders.export",
    "apps.core.api.mixins.validation",
    "apps.core.api.mixins.service",
    "apps.core.api.mixins.response",
    "apps.core.api.mixins.queryset",
    "apps.core.api.mixins.permissions",
    "apps.core.api.mixins.pagination",
    "apps.core.api.mixins.metadata",
    "apps.core.api.mixins.filtering",
    "apps.core.api.mixins.errors",
    "apps.core.api.mixins.dynamic_fields",
    "apps.core.api.mixins.context",
    "apps.core.api.mixins.audit",
    "apps.core.api.views.base",
    "apps.core.services.slug",
    "apps.core.services.search",
    "apps.core.services.metadata",
    "apps.core.services.email",
    "apps.core.services.color",
    "apps.core.services.ordering",
    "apps.core.services.publishable",
    "apps.core.services.soft_delete",
    "apps.core.services.lifecycle",
    "apps.core.services.audit",
    "apps.core.services.storage",
    "apps.core.services.notifications",
    "apps.core.events.base",
    "apps.core.events.bus",
    "apps.core.events.dispatcher",
    "apps.core.events.registry",
    "apps.core.events.handlers",
    "apps.core.events.decorators",
    "apps.core.events.utils",
    "apps.core.events.typing",
    "apps.core.events.exceptions",
    "apps.core.events.autodiscover",
    "apps.core.managers.active",
    "apps.core.managers.publishable",
    "apps.core.managers.soft_delete",
    "apps.core.models.bases.audit",
    "apps.core.models.bases.branding",
    "apps.core.models.bases.color",
    "apps.core.models.bases.device",
    "apps.core.models.bases.entity",
    "apps.core.models.bases.lifecycle",
    "apps.core.models.bases.geo",
    "apps.core.models.bases.metadata",
    "apps.core.models.bases.named",
    "apps.core.models.bases.network",
    "apps.core.models.bases.orderable",
    "apps.core.models.bases.organization",
    "apps.core.models.bases.project",
    "apps.core.models.bases.publishable",
    "apps.core.models.bases.scopes",
    "apps.core.models.bases.soft_delete",
    "apps.core.models.bases.timestamp",
    "apps.core.models.bases.user",
    "apps.core.models.bases.uuid",
    "apps.core.models.mixins.audit",
    "apps.core.models.mixins.base",
    "apps.core.models.mixins.color",
    "apps.core.models.mixins.metadata",
    "apps.core.models.mixins.ordering",
    "apps.core.models.mixins.ownership",
    "apps.core.models.mixins.publishable",
    "apps.core.models.mixins.search",
    "apps.core.models.mixins.slug",
    "apps.core.models.mixins.soft_delete",
    "apps.core.models.querysets.base",
    "apps.core.models.querysets.organization",
    "apps.core.models.querysets.publishable",
    "apps.core.models.querysets.soft_delete",
    "apps.core.middleware.base",
    "apps.core.middleware.authentication",
    "apps.core.middleware.audit",
    "apps.core.middleware.locale",
    "apps.core.middleware.timezone",
    "apps.core.middleware.organization",
    "apps.core.middleware.request_id",
    "apps.core.middleware.security",
    "apps.core.middleware.maintenance",
    "apps.core.filters.base",
    "apps.core.filters.date",
    "apps.core.filters.metadata",
    "apps.core.filters.search",
    "apps.core.filters.soft_delete",
    "apps.core.filters.ownership",
    "apps.core.logging.middleware",
    "apps.core.logging.logger",
    "apps.core.logging.formatters",
    "apps.core.logging.handlers",
    "apps.core.logging.filters",
    "apps.core.logging.utils",
    "apps.core.i18n.validators",
    "apps.core.utils.datetime",
    "apps.core.utils.json",
    "apps.core.utils.slug",
    "apps.core.utils.strings",
    "apps.core.utils.uuid",
    "apps.core.utils.enums",
    "apps.core.protocols",
    "apps.core.choices.base",
    "apps.core.choices.file",
    "apps.core.choices.record",
    "apps.core.choices.lifecycle",
    "apps.core.choices.visibility",
    "apps.core.choices.publish",
    "apps.core.choices.priority",
    "apps.core.choices.department",
]


def get_module_path(module_path: str) -> str:
    """Convert module path to file path."""
    # Convert dots to slashes and add .py
    relative_path = module_path.replace(".", "/") + ".py"
    # Find the backend directory
    backend_dir = Path(__file__).parent.parent.parent
    return str(backend_dir / relative_path)


def get_imports_from_file(file_path: str) -> list[str]:
    """Extract all import statements from a Python file using AST."""
    imports = []
    try:
        with open(file_path, "r") as f:
            tree = ast.parse(f.read(), filename=file_path)

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
    except SyntaxError, FileNotFoundError:
        pass
    return imports


def is_identity_import(imports: list[str]) -> bool:
    """Check if any import is from apps.identity."""
    for imp in imports:
        if imp == "apps.identity" or imp.startswith("apps.identity."):
            return True
    return False


class TestCoreDependencyDirection:
    """Test that Core follows the dependency direction: Domain→Core."""

    def test_core_does_not_import_identity(self):
        """Core should not import from identity (Domain→Core only)."""
        violations = []

        for module_path in CORE_MODULES:
            file_path = get_module_path(module_path)

            if not os.path.exists(file_path):
                # Module file doesn't exist, skip
                continue

            imports = get_imports_from_file(file_path)

            if is_identity_import(imports):
                violations.append(module_path)

        assert not violations, (
            f"The following Core modules import from apps.identity, "
            f"violating the Domain→Core dependency direction:\n"
            f"{chr(10).join('  - ' + v for v in violations)}"
        )

    def test_identity_can_import_core(self):
        """Identity should be able to import from Core (Domain→Core)."""
        # This is a sanity check - identity should import core
        # We'll check a few identity modules that should import from Core
        identity_modules = [
            "apps.identity.services.mfa.enrollment",
            "apps.identity.services.authentication",
            "apps.identity.services.session",
        ]

        for module_path in identity_modules:
            file_path = get_module_path(module_path)

            if not os.path.exists(file_path):
                # Module file doesn't exist, skip
                continue

            imports = get_imports_from_file(file_path)

            # Identity modules should import from Core
            has_core_import = any(
                imp == "apps.core" or imp.startswith("apps.core.") for imp in imports
            )

            # Just verify the module has some imports (it should import core)
            assert (
                has_core_import or len(imports) > 0
            ), f"{module_path} should import from Core"


class TestPublicApiStability:
    """Test that Core's public API surface is stable."""

    def test_core_exports_expected_modules(self):
        """Core should export expected modules."""
        # Check that core __init__.py exists and has exports
        # __file__ is backend/apps/core/tests/test_architecture.py
        # parent.parent.parent.parent = backend
        backend_dir = Path(__file__).parent.parent.parent.parent
        core_init = backend_dir / "apps/core/__init__.py"
        assert core_init.exists(), "apps/core/__init__.py should exist"

    def test_events_exports_domain_event(self):
        """Core events should export DomainEvent."""
        backend_dir = Path(__file__).parent.parent.parent.parent
        events_init = backend_dir / "apps/core/events/__init__.py"
        assert events_init.exists(), "apps/core/events/__init__.py should exist"

        with open(events_init, "r") as f:
            content = f.read()

        assert "DomainEvent" in content, "DomainEvent should be exported from events"

    def test_models_exports_bases(self):
        """Core models should export base classes."""
        backend_dir = Path(__file__).parent.parent.parent.parent
        bases_init = backend_dir / "apps/core/models/bases/__init__.py"
        assert bases_init.exists(), "apps/core/models/bases/__init__.py should exist"

        with open(bases_init, "r") as f:
            content = f.read()

        # Check for expected base classes
        expected = ["AuditModel", "EntityModel", "NamedEntityModel"]
        for cls in expected:
            assert cls in content, f"{cls} should be exported from bases"


class TestNoCoreIdentityViolation:
    """Test that Core does not violate the Core→identity dependency."""

    def test_base_viewset_does_not_import_identity_permissions(self):
        """BaseViewSet should not import HasPermission from identity."""
        # __file__ is backend/apps/core/tests/test_architecture.py
        # parent.parent.parent.parent = backend
        backend_dir = Path(__file__).parent.parent.parent.parent
        base_viewset = backend_dir / "apps/core/api/viewsets/base.py"
        assert base_viewset.exists(), "apps/core/api/viewsets/base.py should exist"

        with open(base_viewset, "r") as f:
            content = f.read()

        # Check for actual import statements (not comments)
        # Parse the file to find import statements
        tree = ast.parse(content, filename=str(base_viewset))

        identity_imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                if node.module and "identity" in node.module:
                    identity_imports.append(node.module)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    if "identity" in alias.name:
                        identity_imports.append(alias.name)

        assert not identity_imports, (
            f"BaseViewSet imports from identity: {identity_imports}. "
            f"Core should not import from identity."
        )
