"""
Organization domain events.
"""

from apps.organization.events.api_key import *
from apps.organization.events.branding import *
from apps.organization.events.calendar import *
from apps.organization.events.department import *
from apps.organization.events.group import *
from apps.organization.events.group_member import *
from apps.organization.events.group_role import *
from apps.organization.events.holiday import *
from apps.organization.events.invitation import *
from apps.organization.events.membership import *
from apps.organization.events.office import *
from apps.organization.events.organization import *
from apps.organization.events.organization_settings import *
from apps.organization.events.permission import *
from apps.organization.events.personal_access_token import *
from apps.organization.events.position import *
from apps.organization.events.role import *
from apps.organization.events.role_permission import *
from apps.organization.events.team import *
from apps.organization.events.user_role import *
from apps.organization.events.work_calendar import *
from apps.organization.events.work_hours import *

__all__ = [
    # API Key
    "APIKeyCreated",
    "APIKeyUpdated",
    "APIKeyDeleted",
    "APIKeyRevoked",
    "APIKeyExpired",
    "APIKeyUsed",
    # Branding
    "BrandingCreated",
    "BrandingUpdated",
    "BrandingArchived",
    "BrandingActivated",
    "BrandingDeactivated",
    "BrandingRestored",
    "BrandingDeleted",
    "BrandingLogoUpdated",
    "BrandingThemeChanged",
    # Calendar
    "CalendarCreated",
    "CalendarUpdated",
    "CalendarDeleted",
    # Department
    "DepartmentCreated",
    "DepartmentUpdated",
    "DepartmentArchived",
    "DepartmentDeleted",
    "DepartmentManagerAssigned",
    "DepartmentMoved",
    "DepartmentRestored",
    "DepartmentActivated",
    "DepartmentDeactivated",
    # Group
    "GroupCreated",
    "GroupUpdated",
    "GroupDeleted",
    "GroupMemberAdded",
    "GroupMemberRemoved",
    "GroupRoleAdded",
    "GroupRoleRemoved",
    # Group Member
    "GroupMemberAdded",
    "GroupMemberRemoved",
    "GroupMemberUpdated",
    # Group Role
    "GroupRoleAdded",
    "GroupRoleRemoved",
    "GroupRoleUpdated",
    # Holiday
    "HolidayCreated",
    "HolidayUpdated",
    "HolidayArchived",
    "HolidayActivated",
    "HolidayDeactivated",
    "HolidayRestored",
    "HolidayDeleted",
    # Invitation
    "InvitationCreated",
    "InvitationSent",
    "InvitationAccepted",
    "InvitationDeclined",
    "InvitationCancelled",
    "InvitationExpired",
    "InvitationActivated",
    "InvitationDeactivated",
    "InvitationArchived",
    "InvitationDeleted",
    "InvitationResent",
    "InvitationRestored",
    # Membership
    "MembershipCreated",
    "MembershipUpdated",
    "MembershipDeleted",
    "MembershipArchived",
    "MembershipActivated",
    "MembershipDeactivated",
    "MembershipReactivated",
    "MembershipRestored",
    "MembershipAccepted",
    "MembershipDeclined",
    "MembershipSuspended",
    "MembershipExpired",
    # Office
    "OfficeCreated",
    "OfficeUpdated",
    "OfficeArchived",
    "OfficeActivated",
    "OfficeDeactivated",
    "OfficeRestored",
    "OfficeDeleted",
    "OfficeManagerAssigned",
    "OfficeHeadquartersChanged",
    # Organization
    "OrganizationCreated",
    "OrganizationUpdated",
    "OrganizationArchived",
    "OrganizationDeleted",
    "OrganizationManagerAssigned",
    "OrganizationMoved",
    "OrganizationRestored",
    "OrganizationActivated",
    "OrganizationDeactivated",
    # Organization Settings
    "OrganizationSettingsCreated",
    "OrganizationSettingsUpdated",
    "OrganizationSettingsDeleted",
    "OrganizationSettingsRestored",
    "OrganizationSettingsArchived",
    "OrganizationSettingsActivated",
    "OrganizationSettingsDeactivated",
    # Personal Access Token
    "PersonalAccessTokenCreated",
    "PersonalAccessTokenUpdated",
    "PersonalAccessTokenDeleted",
    "PersonalAccessTokenRevoked",
    "PersonalAccessTokenExpired",
    "PersonalAccessTokenUsed",
    # Permission
    "PermissionCreated",
    "PermissionUpdated",
    "PermissionDeleted",
    "PermissionGranted",
    "PermissionRevoked",
    # Position
    "PositionCreated",
    "PositionUpdated",
    "PositionArchived",
    "PositionActivated",
    "PositionDeactivated",
    "PositionRestored",
    "PositionDeleted",
    # Role
    "RoleCreated",
    "RoleUpdated",
    "RoleDeleted",
    "RoleAssigned",
    "RoleRevoked",
    "RolePermissionGranted",
    "RolePermissionRevoked",
    # Role Permission
    "RolePermissionGranted",
    "RolePermissionRevoked",
    "RolePermissionUpdated",
    # Team
    "TeamCreated",
    "TeamUpdated",
    "TeamArchived",
    "TeamDeleted",
    "TeamLeadAssigned",
    "TeamDepartmentChanged",
    "TeamMoved",
    "TeamRestored",
    "TeamActivated",
    "TeamDeactivated",
    # User Role
    "UserRoleAssigned",
    "UserRoleRevoked",
    # Work Calendar
    "WorkCalendarCreated",
    "WorkCalendarUpdated",
    "WorkCalendarArchived",
    "WorkCalendarActivated",
    "WorkCalendarDeactivated",
    "WorkCalendarRestored",
    "WorkCalendarDeleted",
    "WorkCalendarDefaultChanged",
    # Work Hours
    "WorkHoursCreated",
    "WorkHoursUpdated",
    "WorkHoursArchived",
    "WorkHoursActivated",
    "WorkHoursDeactivated",
    "WorkHoursRestored",
    "WorkHoursDeleted",
]
