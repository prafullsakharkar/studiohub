"""
Organization templates service.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction

from apps.organization.models import (
    Department,
    Office,
    Organization,
    Team,
)

if TYPE_CHECKING:
    from apps.organization.models import Role


class OrganizationTemplateService:
    """
    Service for creating organizations from templates.
    """

    @classmethod
    def create_from_template(
        cls,
        template_name: str,
        organization_data: dict,
        **kwargs,
    ) -> Organization:
        """
        Create an organization from a template.

        Args:
            template_name: Name of the template to use
            organization_data: Organization data (name, code, etc.)
            **kwargs: Additional options

        Returns:
            Created organization
        """
        template_method = getattr(cls, f"_template_{template_name}", None)

        if template_method is None:
            raise ValueError(f"Template '{template_name}' not found")

        with transaction.atomic():
            # Create organization
            organization = Organization.objects.create(**organization_data)

            # Apply template
            template_method(organization, **kwargs)

            return organization

    @classmethod
    def _template_standard(cls, organization: Organization, **kwargs) -> None:
        """
        Standard template with basic departments and offices.

        Args:
            organization: The organization to apply template to
            **kwargs: Additional options
        """
        # Create default offices
        cls._create_offices(
            organization,
            [
                {
                    "code": "HQ",
                    "name": "Headquarters",
                    "office_type": "headquarters",
                    "is_headquarters": True,
                },
            ],
        )

        # Create default departments
        cls._create_departments(
            organization,
            [
                {
                    "code": "OPS",
                    "name": "Operations",
                    "department_type": "operations",
                },
                {
                    "code": "SALES",
                    "name": "Sales",
                    "department_type": "sales",
                },
                {
                    "code": "MARKETING",
                    "name": "Marketing",
                    "department_type": "marketing",
                },
                {
                    "code": "ENGINEERING",
                    "name": "Engineering",
                    "department_type": "engineering",
                },
                {
                    "code": "HR",
                    "name": "Human Resources",
                    "department_type": "hr",
                },
                {
                    "code": "FINANCE",
                    "name": "Finance",
                    "department_type": "finance",
                },
            ],
        )

    @classmethod
    def _template_startup(cls, organization: Organization, **kwargs) -> None:
        """
        Startup template with minimal structure.

        Args:
            organization: The organization to apply template to
            **kwargs: Additional options
        """
        # Create single office
        cls._create_offices(
            organization,
            [
                {
                    "code": "OFFICE",
                    "name": "Main Office",
                    "office_type": "headquarters",
                    "is_headquarters": True,
                },
            ],
        )

        # Create minimal departments
        cls._create_departments(
            organization,
            [
                {
                    "code": "PRODUCT",
                    "name": "Product",
                    "department_type": "engineering",
                },
                {
                    "code": "ENGINEERING",
                    "name": "Engineering",
                    "department_type": "engineering",
                },
                {
                    "code": "SALES",
                    "name": "Sales",
                    "department_type": "sales",
                },
            ],
        )

    @classmethod
    def _template_enterprise(cls, organization: Organization, **kwargs) -> None:
        """
        Enterprise template with full structure.

        Args:
            organization: The organization to apply template to
            **kwargs: Additional options
        """
        # Create multiple offices
        cls._create_offices(
            organization,
            [
                {
                    "code": "HQ",
                    "name": "Headquarters",
                    "office_type": "headquarters",
                    "is_headquarters": True,
                },
                {
                    "code": "REG1",
                    "name": "Region 1",
                    "office_type": "branch",
                },
                {
                    "code": "REG2",
                    "name": "Region 2",
                    "office_type": "branch",
                },
            ],
        )

        # Create comprehensive departments
        cls._create_departments(
            organization,
            [
                {
                    "code": "EXEC",
                    "name": "Executive",
                    "department_type": "executive",
                },
                {
                    "code": "OPS",
                    "name": "Operations",
                    "department_type": "operations",
                },
                {
                    "code": "SALES",
                    "name": "Sales",
                    "department_type": "sales",
                },
                {
                    "code": "MARKETING",
                    "name": "Marketing",
                    "department_type": "marketing",
                },
                {
                    "code": "ENGINEERING",
                    "name": "Engineering",
                    "department_type": "engineering",
                },
                {
                    "code": "PRODUCT",
                    "name": "Product",
                    "department_type": "product",
                },
                {
                    "code": "DESIGN",
                    "name": "Design",
                    "department_type": "design",
                },
                {
                    "code": "HR",
                    "name": "Human Resources",
                    "department_type": "hr",
                },
                {
                    "code": "FINANCE",
                    "name": "Finance",
                    "department_type": "finance",
                },
                {
                    "code": "LEGAL",
                    "name": "Legal",
                    "department_type": "legal",
                },
                {
                    "code": "SUPPORT",
                    "name": "Customer Support",
                    "department_type": "support",
                },
                {
                    "code": "IT",
                    "name": "IT",
                    "department_type": "it",
                },
            ],
        )

    @classmethod
    def _template_academy(cls, organization: Organization, **kwargs) -> None:
        """
        Academy template for educational organizations.

        Args:
            organization: The organization to apply template to
            **kwargs: Additional options
        """
        # Create campus offices
        cls._create_offices(
            organization,
            [
                {
                    "code": "MAIN",
                    "name": "Main Campus",
                    "office_type": "headquarters",
                    "is_headquarters": True,
                },
                {
                    "code": "EXT",
                    "name": "Extension Campus",
                    "office_type": "branch",
                },
            ],
        )

        # Create academic departments
        cls._create_departments(
            organization,
            [
                {
                    "code": "ADMIN",
                    "name": "Administration",
                    "department_type": "executive",
                },
                {
                    "code": "FACULTY",
                    "name": "Faculty",
                    "department_type": "academic",
                },
                {
                    "code": "RESEARCH",
                    "name": "Research",
                    "department_type": "research",
                },
                {
                    "code": "STUDENT",
                    "name": "Student Services",
                    "department_type": "support",
                },
                {
                    "code": "LIBRARY",
                    "name": "Library",
                    "department_type": "support",
                },
            ],
        )

    @classmethod
    def _template_club(cls, organization: Organization, **kwargs) -> None:
        """
        Club template for sports/club organizations.

        Args:
            organization: The organization to apply template to
            **kwargs: Additional options
        """
        # Create club facilities
        cls._create_offices(
            organization,
            [
                {
                    "code": "CLUBHOUSE",
                    "name": "Clubhouse",
                    "office_type": "headquarters",
                    "is_headquarters": True,
                },
                {
                    "code": "FIELD",
                    "name": "Training Field",
                    "office_type": "branch",
                },
            ],
        )

        # Create club departments
        cls._create_departments(
            organization,
            [
                {
                    "code": "MANAGEMENT",
                    "name": "Management",
                    "department_type": "executive",
                },
                {
                    "code": "COACHING",
                    "name": "Coaching",
                    "department_type": "sports",
                },
                {
                    "code": "TRAINING",
                    "name": "Training",
                    "department_type": "sports",
                },
                {
                    "code": "MATCH",
                    "name": "Match Operations",
                    "department_type": "sports",
                },
                {
                    "code": "MARKETING",
                    "name": "Marketing",
                    "department_type": "marketing",
                },
            ],
        )

    @classmethod
    def _create_offices(
        cls,
        organization: Organization,
        office_data_list: list[dict],
    ) -> None:
        """
        Create offices for an organization.

        Args:
            organization: The organization to create offices for
            office_data_list: List of office data dictionaries
        """
        for office_data in office_data_list:
            Office.objects.create(
                organization=organization,
                **office_data,
            )

    @classmethod
    def _create_departments(
        cls,
        organization: Organization,
        department_data_list: list[dict],
    ) -> None:
        """
        Create departments for an organization.

        Args:
            organization: The organization to create departments for
            department_data_list: List of department data dictionaries
        """
        for dept_data in department_data_list:
            Department.objects.create(
                organization=organization,
                **dept_data,
            )

    @classmethod
    def get_available_templates(cls) -> list[dict]:
        """
        Get list of available templates.

        Returns:
            List of template information
        """
        return [
            {
                "name": "standard",
                "label": "Standard Organization",
                "description": "Complete organization structure with departments and offices",
            },
            {
                "name": "startup",
                "label": "Startup",
                "description": "Minimal structure for startups and small teams",
            },
            {
                "name": "enterprise",
                "label": "Enterprise",
                "description": "Comprehensive structure for large enterprises",
            },
            {
                "name": "academy",
                "label": "Academy",
                "description": "Structure for educational institutions",
            },
            {
                "name": "club",
                "label": "Club",
                "description": "Structure for sports and social clubs",
            },
        ]
