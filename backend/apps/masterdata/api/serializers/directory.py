"""
Global directory serializers (org-removal B3).

Flat frontend shapes for the platform directory: departments, teams,
offices, positions, people, clients, vendors (+ contacts/contracts).
"""

from __future__ import annotations

from rest_framework import serializers

from apps.masterdata.models import (
    Client,
    ClientContact,
    ClientContract,
    Department,
    Office,
    Person,
    Position,
    Team,
    Vendor,
    VendorContact,
    VendorContract,
)


class DepartmentSerializer(serializers.ModelSerializer[Department]):
    class Meta:
        model = Department
        fields = (
            "id",
            "code",
            "name",
            "description",
            "parent",
            "department_type",
            "manager",
            "color",
            "software_stack",
            "capacity_hours_weekly",
            "utilization_percentage",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class TeamSerializer(serializers.ModelSerializer[Team]):
    class Meta:
        model = Team
        fields = (
            "id",
            "code",
            "name",
            "description",
            "department",
            "lead",
            "focus_discipline",
            "current_project_code",
            "utilization_percentage",
            "color",
            "capacity",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class OfficeSerializer(serializers.ModelSerializer[Office]):
    class Meta:
        model = Office
        fields = (
            "id",
            "code",
            "name",
            "description",
            "office_type",
            "timezone",
            "country",
            "state",
            "city",
            "address",
            "postal_code",
            "phone",
            "email",
            "manager",
            "working_hours",
            "headcount",
            "workstations_count",
            "render_nodes_count",
            "is_active",
            "is_headquarters",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PositionSerializer(serializers.ModelSerializer[Position]):
    class Meta:
        model = Position
        fields = (
            "id",
            "code",
            "name",
            "description",
            "department",
            "parent",
            "level",
            "is_managerial",
            "band_level",
            "salary_range",
            "employment_type",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PersonSerializer(serializers.ModelSerializer[Person]):
    full_name = serializers.CharField(source="name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    team_name = serializers.CharField(source="team.name", read_only=True, default="")
    office_name = serializers.CharField(source="office.name", read_only=True, default="")

    class Meta:
        model = Person
        fields = (
            "id",
            "name",
            "full_name",
            "description",
            "status",
            "user",
            "role",
            "department",
            "department_name",
            "team",
            "team_name",
            "office",
            "office_name",
            "seniority",
            "skills",
            "timezone",
            "security_clearance",
            "availability_status",
            "email",
            "phone",
            "date_of_birth",
            "nationality",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ClientSerializer(serializers.ModelSerializer[Client]):
    class Meta:
        model = Client
        fields = (
            "id",
            "name",
            "code",
            "contact_name",
            "email",
            "phone",
            "studio_type",
            "active_projects",
            "contract_tier",
            "portal_access",
            "status",
            "logo_url",
            "headquarters",
            "total_billed_usd",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class VendorSerializer(serializers.ModelSerializer[Vendor]):
    class Meta:
        model = Vendor
        fields = (
            "id",
            "name",
            "code",
            "contact_name",
            "email",
            "specialization",
            "security_tier",
            "nda_signed",
            "active_tasks_count",
            "active_projects",
            "rating",
            "location",
            "status",
            "logo_url",
            "bandwidth_gbps",
            "bandwidth_link",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ClientContactSerializer(serializers.ModelSerializer[ClientContact]):
    class Meta:
        model = ClientContact
        fields = (
            "id",
            "client",
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "portal_access",
            "is_primary",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ClientContractSerializer(serializers.ModelSerializer[ClientContract]):
    class Meta:
        model = ClientContract
        fields = (
            "id",
            "client",
            "contract_number",
            "title",
            "type",
            "effective_date",
            "expiry_date",
            "value_usd",
            "status",
            "nda_signed",
            "document_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class VendorContactSerializer(serializers.ModelSerializer[VendorContact]):
    class Meta:
        model = VendorContact
        fields = (
            "id",
            "vendor",
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "is_primary",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class VendorContractSerializer(serializers.ModelSerializer[VendorContract]):
    class Meta:
        model = VendorContract
        fields = (
            "id",
            "vendor",
            "contract_number",
            "title",
            "type",
            "effective_date",
            "expiry_date",
            "total_value_usd",
            "nda_signed",
            "security_tier",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
