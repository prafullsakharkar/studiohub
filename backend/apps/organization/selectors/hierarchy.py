"""
Organization hierarchy selectors.
"""

from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING

from django.db.models import QuerySet

from apps.organization.models import (
    Department,
    Office,
    Organization,
    Position,
    Team,
)

if TYPE_CHECKING:
    from django.db.models import QuerySet


class OrganizationHierarchySelector:
    """
    Selector for organization hierarchy data.
    """

    @classmethod
    def get_organization_tree(
        cls,
        organization: Organization,
    ) -> dict:
        """
        Get organization hierarchy as a tree structure.

        Args:
            organization: The organization to get hierarchy for

        Returns:
            Dictionary with organization hierarchy
        """
        departments = cls.get_departments_with_children(organization)
        offices = cls.get_offices(organization)
        teams = cls.get_teams_with_children(organization)
        positions = cls.get_positions_with_children(organization)

        return {
            "organization": {
                "id": str(organization.id),
                "code": organization.code,
                "name": organization.name,
            },
            "departments": departments,
            "offices": offices,
            "teams": teams,
            "positions": positions,
        }

    @classmethod
    def get_departments_with_children(
        cls,
        organization: Organization,
    ) -> list[dict]:
        """
        Get departments with nested children.

        Args:
            organization: The organization to get departments for

        Returns:
            List of departments with nested children
        """
        departments = Department.objects.filter(
            organization=organization,
        ).select_related("parent", "manager").order_by("name")

        department_dict = {}
        root_departments = []

        for dept in departments:
            dept_data = {
                "id": str(dept.id),
                "code": dept.code,
                "name": dept.name,
                "description": dept.description,
                "department_type": dept.department_type,
                "parent_id": str(dept.parent.id) if dept.parent else None,
                "manager_id": str(dept.manager.id) if dept.manager else None,
                "manager_name": dept.manager.display_name if dept.manager else None,
                "children": [],
            }

            department_dict[dept.id] = dept_data

            if dept.parent_id:
                parent = department_dict.get(dept.parent_id)
                if parent:
                    parent["children"].append(dept_data)
            else:
                root_departments.append(dept_data)

        return root_departments

    @classmethod
    def get_offices(cls, organization: Organization) -> list[dict]:
        """
        Get all offices for an organization.

        Args:
            organization: The organization to get offices for

        Returns:
            List of offices
        """
        offices = Office.objects.filter(
            organization=organization,
        ).select_related("manager").order_by("name")

        return [
            {
                "id": str(office.id),
                "code": office.code,
                "name": office.name,
                "office_type": office.office_type,
                "timezone": office.timezone,
                "country": office.country,
                "state": office.state,
                "city": office.city,
                "address": office.address,
                "postal_code": office.postal_code,
                "phone": office.phone,
                "email": office.email,
                "manager_id": str(office.manager.id) if office.manager else None,
                "manager_name": office.manager.display_name if office.manager else None,
                "is_headquarters": office.is_headquarters,
            }
            for office in offices
        ]

    @classmethod
    def get_teams_with_children(
        cls,
        organization: Organization,
    ) -> list[dict]:
        """
        Get teams with nested children.

        Args:
            organization: The organization to get teams for

        Returns:
            List of teams with nested children
        """
        teams = Team.objects.filter(
            organization=organization,
        ).select_related("department", "lead").order_by("name")

        team_dict = {}
        root_teams = []

        for team in teams:
            team_data = {
                "id": str(team.id),
                "code": team.code,
                "name": team.name,
                "department_id": str(team.department.id) if team.department else None,
                "department_name": team.department.name if team.department else None,
                "lead_id": str(team.lead.id) if team.lead else None,
                "lead_name": team.lead.display_name if team.lead else None,
                "color": team.color,
                "capacity": team.capacity,
                "children": [],
            }

            team_dict[team.id] = team_data
            root_teams.append(team_data)

        return root_teams

    @classmethod
    def get_positions_with_children(
        cls,
        organization: Organization,
    ) -> list[dict]:
        """
        Get positions with nested children.

        Args:
            organization: The organization to get positions for

        Returns:
            List of positions with nested children
        """
        positions = Position.objects.filter(
            organization=organization,
        ).select_related("department", "parent").order_by("level", "name")

        position_dict = {}
        root_positions = []

        for pos in positions:
            pos_data = {
                "id": str(pos.id),
                "code": pos.code,
                "name": pos.name,
                "department_id": str(pos.department.id) if pos.department else None,
                "department_name": pos.department.name if pos.department else None,
                "parent_id": str(pos.parent.id) if pos.parent else None,
                "level": pos.level,
                "is_managerial": pos.is_managerial,
                "children": [],
            }

            position_dict[pos.id] = pos_data

            if pos.parent_id:
                parent = position_dict.get(pos.parent_id)
                if parent:
                    parent["children"].append(pos_data)
            else:
                root_positions.append(pos_data)

        return root_positions

    @classmethod
    def get_department_tree(
        cls,
        department: Department,
    ) -> dict:
        """
        Get department hierarchy as a tree structure.

        Args:
            department: The department to get hierarchy for

        Returns:
            Dictionary with department hierarchy
        """
        return {
            "id": str(department.id),
            "code": department.code,
            "name": department.name,
            "description": department.description,
            "department_type": department.department_type,
            "parent_id": str(department.parent.id) if department.parent else None,
            "manager_id": str(department.manager.id) if department.manager else None,
            "children": [
                cls.get_department_tree(child)
                for child in department.children.all()
            ],
        }

    @classmethod
    def get_team_tree(
        cls,
        team: Team,
    ) -> dict:
        """
        Get team hierarchy as a tree structure.

        Args:
            team: The team to get hierarchy for

        Returns:
            Dictionary with team hierarchy
        """
        return {
            "id": str(team.id),
            "code": team.code,
            "name": team.name,
            "department_id": str(team.department.id) if team.department else None,
            "lead_id": str(team.lead.id) if team.lead else None,
            "color": team.color,
            "capacity": team.capacity,
        }
