class OrganizationPermissions:
    VIEW = "organization.view"
    CREATE = "organization.create"
    UPDATE = "organization.update"
    DELETE = "organization.delete"


class DepartmentPermissions:
    VIEW = "organization.department.view"
    CREATE = "organization.department.create"
    UPDATE = "organization.department.update"
    DELETE = "organization.department.delete"
    ARCHIVE = "organization.department.archive"


class TeamPermissions:
    VIEW = "organization.team.view"
    CREATE = "organization.team.create"
    UPDATE = "organization.team.update"
    DELETE = "organization.team.delete"
    ARCHIVE = "organization.team.archive"


class OfficePermissions:
    VIEW = "organization.office.view"
    CREATE = "organization.office.create"
    UPDATE = "organization.office.update"
    DELETE = "organization.office.delete"
    ARCHIVE = "organization.office.archive"


class OrganizationSettingsPermissions:
    VIEW = "organization_settings.view"
    CREATE = "organization_settings.create"
    UPDATE = "organization_settings.update"
    DELETE = "organization_settings.delete"


class BrandingPermissions:
    VIEW = "branding.view"
    CREATE = "branding.create"
    UPDATE = "branding.update"
    DELETE = "branding.delete"


class HolidayPermissions:
    VIEW = "holiday.view"
    CREATE = "holiday.create"
    UPDATE = "holiday.update"
    DELETE = "holiday.delete"


class WorkCalendarPermissions:
    VIEW = "work_calendar.view"
    CREATE = "work_calendar.create"
    UPDATE = "work_calendar.update"
    DELETE = "work_calendar.delete"


class WorkHoursPermissions:
    VIEW = "work_hours.view"
    CREATE = "work_hours.create"
    UPDATE = "work_hours.update"
    DELETE = "work_hours.delete"


class CalendarPermissions:
    VIEW = "calendar.view"
    CREATE = "calendar.create"
    UPDATE = "calendar.update"
    DELETE = "calendar.delete"


class PositionPermissions:
    VIEW = "position.view"
    CREATE = "position.create"
    UPDATE = "position.update"
    DELETE = "position.delete"


class InvitationPermissions:
    VIEW = "invitation.view"
    CREATE = "invitation.create"
    UPDATE = "invitation.update"
    DELETE = "invitation.delete"
    ACCEPT = "invitation.accept"
    DECLINE = "invitation.decline"
    CANCEL = "invitation.cancel"


class OrganizationMembershipPermissions:
    VIEW = "organization_membership.view"
    CREATE = "organization_membership.create"
    UPDATE = "organization_membership.update"
    DELETE = "organization_membership.delete"
    ACTIVATE = "organization_membership.activate"
    DEACTIVATE = "organization_membership.deactivate"


class APIKeyPermissions:
    VIEW = "api_key.view"
    CREATE = "api_key.create"
    UPDATE = "api_key.update"
    DELETE = "api_key.delete"
    REVOKE = "api_key.revoke"


class PersonalAccessTokenPermissions:
    VIEW = "personal_access_token.view"
    CREATE = "personal_access_token.create"
    UPDATE = "personal_access_token.update"
    DELETE = "personal_access_token.delete"
    REVOKE = "personal_access_token.revoke"


class GroupPermissions:
    VIEW = "group.view"
    CREATE = "group.create"
    UPDATE = "group.update"
    DELETE = "group.delete"
    ADD_MEMBER = "group.add_member"
    REMOVE_MEMBER = "group.remove_member"
    ADD_ROLE = "group.add_role"
    REMOVE_ROLE = "group.remove_role"


class RolePermissions:
    VIEW = "role.view"
    CREATE = "role.create"
    UPDATE = "role.update"
    DELETE = "role.delete"
    ASSIGN = "role.assign"
    REVOKE = "role.revoke"
    GRANT_PERMISSION = "role.grant_permission"
    REVOKE_PERMISSION = "role.revoke_permission"


class PermissionPermissions:
    VIEW = "permission.view"
    CREATE = "permission.create"
    UPDATE = "permission.update"
    DELETE = "permission.delete"


class UserRolePermissions:
    ASSIGN = "user_role.assign"
    REVOKE = "user_role.revoke"


class GroupMemberPermissions:
    ADD = "group_member.add"
    REMOVE = "group_member.remove"
    UPDATE = "group_member.update"


class GroupRolePermissions:
    ADD = "group_role.add"
    REMOVE = "group_role.remove"
    UPDATE = "group_role.update"


class RolePermissionPermissions:
    GRANT = "role_permission.grant"
    REVOKE = "role_permission.revoke"
    UPDATE = "role_permission.update"


class PersonPermissions:
    VIEW = "person.view"
    CREATE = "person.create"
    UPDATE = "person.update"
    DELETE = "person.delete"
