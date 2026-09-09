// Core Foundation Types

export type PageRequest = {
    page?: number;
    page_size?: number;
    search?: string;
    ordering?: string;
    [key: string]: string | number | boolean | null | undefined;
};

export type PaginatedResponse<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export type ApiResponse<T> = {
    data: T;
    message?: string;
};

export type ErrorResponse = {
    detail?: string;
    [key: string]: string | string[] | undefined;
};

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT' | 'ARCHIVE' | 'RESTORE' | 'ACTIVATE' | 'DEACTIVATE' | 'SUSPEND' | 'UNSUSPEND';

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AuditLog = {
    id: string;
    timestamp: string;
    actor: string;
    actor_email: string;
    action: AuditAction;
    resource_type: string;
    resource_id: string;
    resource_name?: string;
    organization?: string;
    organization_id?: string;
    ip_address?: string;
    user_agent?: string;
    request_id?: string;
    status: 'SUCCESS' | 'FAILURE';
    severity: AuditSeverity;
    previous_values?: Record<string, unknown>;
    new_values?: Record<string, unknown>;
    changed_fields?: string[];
};

export type ActivityItem = {
    id: string;
    timestamp: string;
    actor: string;
    actor_avatar?: string;
    action: string;
    target?: string;
    target_type?: string;
    target_id?: string;
    details?: string;
    metadata?: Record<string, unknown>;
};

export type PermissionDefinition = {
    code: string;
    name: string;
    description: string;
    module: string;
    resource: string;
    category: 'read' | 'create' | 'update' | 'delete' | 'manage' | 'special';
};

export type RoleDefinition = {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    is_system?: boolean;
    created_at: string;
    updated_at: string;
};

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';

export type User = {
    id: string;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    avatar?: string;
    status: UserStatus;
    is_active: boolean;
    is_superuser: boolean;
    is_staff: boolean;
    last_login?: string;
    date_joined: string;
    roles: string[];
    permissions: string[];
    mfa_enabled: boolean;
    mfa_methods?: string[];
    last_security_event?: string;
};

export type CreateUser = {
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    password?: string;
    roles?: string[];
    is_active?: boolean;
    is_staff?: boolean;
    is_superuser?: boolean;
    organization?: string;
};

export type UpdateUser = {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    password?: string;
    roles?: string[];
    is_active?: boolean;
    is_staff?: boolean;
    is_superuser?: boolean;
    organization?: string;
};

export type Role = {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    user_count?: number;
    is_system?: boolean;
    created_at: string;
    updated_at: string;
};

export type CreateRole = {
    name: string;
    description?: string;
    permissions?: string[];
    is_system?: boolean;
};

export type UpdateRole = {
    name?: string;
    description?: string;
    permissions?: string[];
    is_system?: boolean;
};

export type Permission = {
    code: string;
    name: string;
    module: string;
    resource: string;
    category: string;
};

export type Session = {
    id: string;
    user_id: string;
    user_agent: string;
    ip_address: string;
    location?: string;
    is_current: boolean;
    created_at: string;
    last_activity: string;
    expires_at: string;
};

export type MFAConfig = {
    enabled: boolean;
    methods: ('totp' | 'sms' | 'email')[];
    totp?: {
        secret?: string;
        uri?: string;
        verified: boolean;
    };
    sms?: {
        phone_number?: string;
        verified: boolean;
    };
    email?: {
        email?: string;
        verified: boolean;
    };
    recovery_codes?: string[];
};

export type MFATOTPSetup = {
    secret: string;
    uri: string;
    qr_code?: string;
};

export type MFASMSVerify = {
    phone_number: string;
    verification_sent: boolean;
};

export type MFAEmailVerify = {
    email: string;
    verification_sent: boolean;
};

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';

export type Invitation = {
    id: string;
    email: string;
    organization: string;
    organization_id: string;
    role: string;
    department?: string;
    team?: string;
    status: InvitationStatus;
    invited_by: string;
    invited_by_email: string;
    invited_at: string;
    expires_at: string;
    accepted_at?: string;
    declined_at?: string;
    cancelled_at?: string;
};

export type OrganizationStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';

export type Organization = {
    id: string;
    name: string;
    slug: string;
    code: string;
    description?: string;
    logo?: string;
    banner?: string;
    status: OrganizationStatus;
    settings?: Record<string, unknown>;
    contact_email?: string;
    contact_phone?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postal_code?: string;
    };
    timezone?: string;
    created_at: string;
    updated_at: string;
};

export type CreateOrganization = {
    name: string;
    slug?: string;
    code: string;
    description?: string;
    logo?: string;
    banner?: string;
    contact_email?: string;
    contact_phone?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postal_code?: string;
    };
    timezone?: string;
    settings?: Record<string, unknown>;
};

export type UpdateOrganization = {
    name?: string;
    slug?: string;
    code?: string;
    description?: string;
    logo?: string;
    banner?: string;
    contact_email?: string;
    contact_phone?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postal_code?: string;
    };
    timezone?: string;
    settings?: Record<string, unknown>;
    status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
};

export type Department = {
    id: string;
    name: string;
    slug: string;
    description?: string;
    head?: string;
    head_name?: string;
    parent?: string;
    parent_name?: string;
    organization: string;
    organization_name?: string;
    status: 'ACTIVE' | 'ARCHIVED';
    member_count?: number;
    created_at: string;
    updated_at: string;
};

export type CreateDepartment = {
    name: string;
    slug?: string;
    description?: string;
    head?: string;
    parent?: string;
    organization: string;
};

export type UpdateDepartment = {
    name?: string;
    slug?: string;
    description?: string;
    head?: string;
    parent?: string;
    status?: 'ACTIVE' | 'ARCHIVED';
};

export type TeamType = 'PRODUCTION' | 'TECHNICAL' | 'ADMINISTRATIVE' | 'ARTISTIC';

export type Team = {
    id: string;
    name: string;
    slug: string;
    description?: string;
    lead?: string;
    lead_name?: string;
    department?: string;
    department_name?: string;
    organization: string;
    organization_name?: string;
    type: TeamType;
    status: 'ACTIVE' | 'ARCHIVED';
    member_count?: number;
    created_at: string;
    updated_at: string;
};

export type Office = {
    id: string;
    name: string;
    slug: string;
    description?: string;
    address: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postal_code?: string;
    };
    timezone?: string;
    contact_email?: string;
    contact_phone?: string;
    organization: string;
    organization_name?: string;
    status: 'ACTIVE' | 'ARCHIVED';
    created_at: string;
    updated_at: string;
};

export type CreateTeam = {
    name: string;
    slug?: string;
    description?: string;
    lead?: string;
    department?: string;
    organization: string;
    type?: 'PRODUCTION' | 'TECHNICAL' | 'ADMINISTRATIVE' | 'ARTISTIC';
};

export type UpdateTeam = {
    name?: string;
    slug?: string;
    description?: string;
    lead?: string;
    department?: string;
    type?: 'PRODUCTION' | 'TECHNICAL' | 'ADMINISTRATIVE' | 'ARTISTIC';
    status?: 'ACTIVE' | 'ARCHIVED';
};

export type CreateOffice = {
    name: string;
    slug?: string;
    description?: string;
    address: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postal_code?: string;
    };
    timezone?: string;
    contact_email?: string;
    contact_phone?: string;
    organization: string;
};

export type UpdateOffice = {
    name?: string;
    slug?: string;
    description?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postal_code?: string;
    };
    timezone?: string;
    contact_email?: string;
    contact_phone?: string;
    status?: 'ACTIVE' | 'ARCHIVED';
};

export type CreateMembership = {
    user: string;
    organization: string;
    role: string;
    department?: string;
    team?: string;
    is_primary?: boolean;
};

export type UpdateMembership = {
    role?: string;
    department?: string;
    team?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    is_primary?: boolean;
};

export type CreateInvitation = {
    email: string;
    organization: string;
    role: string;
    department?: string;
    team?: string;
};

export type UpdateInvitation = {
    role?: string;
    department?: string;
    team?: string;
    status?: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
};

export type MembershipStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type Membership = {
    id: string;
    user: string;
    user_email: string;
    user_name?: string;
    user_avatar?: string;
    organization: string;
    organization_name?: string;
    role: string;
    role_name?: string;
    department?: string;
    department_name?: string;
    team?: string;
    team_name?: string;
    status: MembershipStatus;
    is_primary: boolean;
    joined_at: string;
    left_at?: string;
    permissions: string[];
};

export type SettingCategory = 'GENERAL' | 'SYSTEM' | 'SECURITY' | 'AUTHENTICATION' | 'NOTIFICATIONS' | 'LOCALIZATION' | 'BRANDING' | 'INTEGRATIONS' | 'FEATURE_FLAGS';

export type Setting = {
    key: string;
    category: SettingCategory;
    label: string;
    description?: string;
    value: unknown;
    type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json';
    options?: { value: string; label: string }[];
    is_required?: boolean;
    is_secret?: boolean;
    is_readonly?: boolean;
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        required?: boolean;
    };
    updated_at?: string;
    updated_by?: string;
};

export type FeatureFlag = {
    key: string;
    name: string;
    description?: string;
    enabled: boolean;
    scope: 'GLOBAL' | 'ORGANIZATION' | 'USER';
    conditions?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
};
