"""
Global directory serializers.

Flat frontend shapes for the platform directory: departments, teams,
offices, positions, people, clients, vendors (+ contacts/contracts).
"""

from __future__ import annotations

from typing import Any, ClassVar

from rest_framework import serializers

from apps.masterdata.api.serializers.gating import GatedFieldsMixin
from apps.masterdata.constants.permissions import MasterdataPermissions
from apps.masterdata.models import (
    Client,
    ClientContact,
    ClientContract,
    ContractStatus,
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
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        validators = []


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
            "color",
            "capacity",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        validators = []


class OfficeSerializer(serializers.ModelSerializer[Office]):
    # Computed from live, active people (DECISIONS D11); the stored column is not used.
    headcount = serializers.IntegerField(source="live_headcount", read_only=True)

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
        validators = []
        extra_kwargs = {"is_headquarters": {"validators": []}}


class PositionSerializer(GatedFieldsMixin, serializers.ModelSerializer[Position]):
    gated_fields = {MasterdataPermissions.PERSON_VIEW_SENSITIVE: ("salary_range",)}

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
        validators = []


class PersonSerializer(GatedFieldsMixin, serializers.ModelSerializer[Person]):
    gated_fields = {
        MasterdataPermissions.PERSON_VIEW_SENSITIVE: (
            "email",
            "phone",
            "date_of_birth",
            "nationality",
            "security_clearance",
        )
    }
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
        # ``user`` changes only through link-user / unlink-user (DECISIONS D4).
        read_only_fields = ("id", "user", "created_at", "updated_at")
        validators = []
        extra_kwargs = {"email": {"validators": []}}


SENSITIVE = MasterdataPermissions.PERSON_VIEW_SENSITIVE
FINANCIAL = MasterdataPermissions.CLIENT_VIEW_FINANCIAL
_READ_ONLY = ("id", "created_at", "updated_at")


class ClientSerializer(GatedFieldsMixin, serializers.ModelSerializer[Client]):
    """Mixed endpoint: ordinary fields for everyone, contact data and the billed total gated."""

    gated_fields = {
        SENSITIVE: ("contact_name", "email", "phone"),
        FINANCIAL: ("total_billed_usd",),
    }
    # Annotated by the selector. The contacts themselves are never embedded (H1).
    contact_count = serializers.IntegerField(read_only=True)

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
            "contract_tier",
            "portal_access",
            "status",
            "logo_url",
            "headquarters",
            "total_billed_usd",
            "contact_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*_READ_ONLY, "contact_count")
        validators = []


class VendorSerializer(GatedFieldsMixin, serializers.ModelSerializer[Vendor]):
    gated_fields = {SENSITIVE: ("contact_name", "email")}
    contact_count = serializers.IntegerField(read_only=True)

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
            "rating",
            "location",
            "status",
            "logo_url",
            "bandwidth_gbps",
            "bandwidth_link",
            "contact_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*_READ_ONLY, "contact_count")
        validators = []


class _ParentImmutableMixin:
    """The owner of a contact or contract is chosen at creation and never changes."""

    parent_field: ClassVar[str]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        instance = getattr(self, "instance", None)
        if instance is not None and self.parent_field in attrs:
            if attrs[self.parent_field] != getattr(instance, self.parent_field):
                raise serializers.ValidationError(
                    {self.parent_field: ["Cannot be changed after creation."]}
                )
            attrs.pop(self.parent_field)
        return attrs


class ClientContactSerializer(_ParentImmutableMixin, serializers.ModelSerializer[ClientContact]):
    """Purely sensitive: the whole endpoint needs ``masterdata.person.view_sensitive``."""

    parent_field = "client"

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
        read_only_fields = _READ_ONLY
        validators = []
        extra_kwargs = {"client": {"validators": []}}


class VendorContactSerializer(_ParentImmutableMixin, serializers.ModelSerializer[VendorContact]):
    parent_field = "vendor"

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
        read_only_fields = _READ_ONLY
        validators = []
        extra_kwargs = {"vendor": {"validators": []}}


class _ContractSerializer(
    GatedFieldsMixin, _ParentImmutableMixin, serializers.ModelSerializer[Any]
):
    """``status`` is accepted on create only (Draft or Active) and reported **derived**."""

    status = serializers.ChoiceField(
        choices=[(ContractStatus.DRAFT.value, "Draft"), (ContractStatus.ACTIVE.value, "Active")],
        required=False,
    )

    def to_representation(self, instance: Any) -> Any:
        data = super().to_representation(instance)
        data["status"] = instance.effective_status()
        return data


class ClientContractSerializer(_ContractSerializer):
    parent_field = "client"
    gated_fields = {FINANCIAL: ("value_usd",)}

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
            "currency",
            "status",
            "nda_signed",
            "document_url",
            "activated_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*_READ_ONLY, "activated_at")
        validators = []
        extra_kwargs = {"client": {"validators": []}}


class VendorContractSerializer(_ContractSerializer):
    parent_field = "vendor"
    gated_fields = {FINANCIAL: ("total_value_usd",)}

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
            "currency",
            "nda_signed",
            "security_tier",
            "status",
            "activated_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*_READ_ONLY, "activated_at")
        validators = []
        extra_kwargs = {"vendor": {"validators": []}}


class LinkUserSerializer(serializers.Serializer[dict[str, Any]]):
    user = serializers.UUIDField()


class DeactivateSerializer(serializers.Serializer[dict[str, Any]]):
    status = serializers.ChoiceField(choices=["inactive", "archived"], default="inactive")


class AdjustEndDateSerializer(serializers.Serializer[dict[str, Any]]):
    expiry_date = serializers.DateField(allow_null=True)
