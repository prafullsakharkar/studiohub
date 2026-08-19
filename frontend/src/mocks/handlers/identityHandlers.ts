import { http, HttpResponse } from 'msw';
import { mockUsers, mockRoles, mockPermissions, mockSessions, mockMFAConfig } from '../db/identity/identity';

// User Handlers
export const userHandlers = [
    http.get('*/api/v1/users/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';
        const role = url.searchParams.get('role') || '';

        let filteredUsers = [...mockUsers];

        if (search) {
            const searchLower = search.toLowerCase();
            filteredUsers = filteredUsers.filter(
                (user) =>
                    user.username.toLowerCase().includes(searchLower) ||
                    user.email.toLowerCase().includes(searchLower) ||
                    user.first_name?.toLowerCase().includes(searchLower) ||
                    user.last_name?.toLowerCase().includes(searchLower)
            );
        }

        if (status) {
            filteredUsers = filteredUsers.filter((user) => user.status === status);
        }

        if (role) {
            filteredUsers = filteredUsers.filter((user) => user.roles.includes(role));
        }

        const totalCount = filteredUsers.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedUsers,
        });
    }),

    http.get('*/api/v1/users/:id/', async ({ params }) => {
        const user = mockUsers.find((u) => u.id === params.id);
        if (!user) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json(user);
    }),

    http.post('*/api/v1/users/', async ({ request }) => {
        const userData = (await request.json()) as Record<string, unknown>;
        const newUser = {
            id: `usr-${Date.now().toString().slice(-6)}`,
            ...userData,
            date_joined: new Date().toISOString(),
            last_login: null,
            permissions: [],
            mfa_enabled: false,
            mfa_methods: [],
        };
        return HttpResponse.json(newUser, { status: 201 });
    }),

    http.put('*/api/v1/users/:id/', async ({ params, request }) => {
        const userData = (await request.json()) as Record<string, unknown>;
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        const updatedUser = { ...mockUsers[userIndex], ...userData };
        return HttpResponse.json(updatedUser);
    }),

    http.patch('*/api/v1/users/:id/', async ({ params, request }) => {
        const userData = (await request.json()) as Record<string, unknown>;
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        const updatedUser = { ...mockUsers[userIndex], ...userData };
        return HttpResponse.json(updatedUser);
    }),

    http.delete('*/api/v1/users/:id/', async ({ params }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/users/:id/activate/', async ({ params }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockUsers[userIndex], is_active: true, status: 'ACTIVE' });
    }),

    http.post('*/api/v1/users/:id/deactivate/', async ({ params }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockUsers[userIndex], is_active: false, status: 'INACTIVE' });
    }),

    http.post('*/api/v1/users/:id/suspend/', async ({ params }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockUsers[userIndex], is_active: false, status: 'SUSPENDED' });
    }),

    http.post('*/api/v1/users/:id/unsuspend/', async ({ params }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockUsers[userIndex], is_active: true, status: 'ACTIVE' });
    }),

    http.post('*/api/v1/users/:id/reset-password/', async ({ params }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: 'Password reset email sent' });
    }),

    http.post('*/api/v1/users/:id/force-password-change/', async ({ params }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: 'User will be forced to change password on next login' });
    }),

    http.post('*/api/v1/users/:id/revoke-sessions/', async ({ params }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: 'All sessions revoked' });
    }),

    http.get('*/api/v1/users/:id/roles/', async ({ params }) => {
        const user = mockUsers.find((u) => u.id === params.id);
        if (!user) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        return HttpResponse.json({ roles: user.roles });
    }),

    http.post('*/api/v1/users/:id/roles/', async ({ params, request }) => {
        const userIndex = mockUsers.findIndex((u) => u.id === params.id);
        if (userIndex === -1) {
            return HttpResponse.json({ detail: 'User not found' }, { status: 404 });
        }
        const { roles } = (await request.json()) as { roles: string[] };
        return HttpResponse.json({ roles });
    }),
];

// Role Handlers
export const roleHandlers = [
    http.get('*/api/v1/roles/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const search = url.searchParams.get('search') || '';

        let filteredRoles = [...mockRoles];

        if (search) {
            const searchLower = search.toLowerCase();
            filteredRoles = filteredRoles.filter((role) =>
                role.name.toLowerCase().includes(searchLower) ||
                role.description.toLowerCase().includes(searchLower)
            );
        }

        const totalCount = filteredRoles.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedRoles = filteredRoles.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedRoles,
        });
    }),

    http.get('*/api/v1/roles/:id/', async ({ params }) => {
        const role = mockRoles.find((r) => r.id === params.id);
        if (!role) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        return HttpResponse.json(role);
    }),

    http.post('*/api/v1/roles/', async ({ request }) => {
        const roleData = (await request.json()) as Record<string, unknown>;
        const newRole = {
            id: `role-${Date.now().toString().slice(-6)}`,
            ...roleData,
            user_count: 0,
            is_system: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return HttpResponse.json(newRole, { status: 201 });
    }),

    http.put('*/api/v1/roles/:id/', async ({ params, request }) => {
        const roleData = (await request.json()) as Record<string, unknown>;
        const roleIndex = mockRoles.findIndex((r) => r.id === params.id);
        if (roleIndex === -1) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        const updatedRole = { ...mockRoles[roleIndex], ...roleData };
        return HttpResponse.json(updatedRole);
    }),

    http.patch('*/api/v1/roles/:id/', async ({ params, request }) => {
        const roleData = (await request.json()) as Record<string, unknown>;
        const roleIndex = mockRoles.findIndex((r) => r.id === params.id);
        if (roleIndex === -1) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        const updatedRole = { ...mockRoles[roleIndex], ...roleData };
        return HttpResponse.json(updatedRole);
    }),

    http.delete('*/api/v1/roles/:id/', async ({ params }) => {
        const roleIndex = mockRoles.findIndex((r) => r.id === params.id);
        if (roleIndex === -1) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/roles/:id/clone/', async ({ params }) => {
        const role = mockRoles.find((r) => r.id === params.id);
        if (!role) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        const clonedRole = {
            ...role,
            id: `role-${Date.now().toString().slice(-6)}`,
            name: `${role.name}-copy`,
            user_count: 0,
            is_system: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return HttpResponse.json(clonedRole, { status: 201 });
    }),

    http.get('*/api/v1/roles/:id/permissions/', async ({ params }) => {
        const role = mockRoles.find((r) => r.id === params.id);
        if (!role) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        return HttpResponse.json({ permissions: role.permissions });
    }),

    http.post('*/api/v1/roles/:id/permissions/', async ({ params, request }) => {
        const roleIndex = mockRoles.findIndex((r) => r.id === params.id);
        if (roleIndex === -1) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        const { permissions } = (await request.json()) as { permissions: string[] };
        return HttpResponse.json({ permissions });
    }),

    http.post('*/api/v1/roles/:id/permissions/add/', async ({ params, request }) => {
        const roleIndex = mockRoles.findIndex((r) => r.id === params.id);
        if (roleIndex === -1) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        const { permission } = (await request.json()) as { permission: string };
        return HttpResponse.json({ permission });
    }),

    http.post('*/api/v1/roles/:id/permissions/remove/', async ({ params, request }) => {
        const roleIndex = mockRoles.findIndex((r) => r.id === params.id);
        if (roleIndex === -1) {
            return HttpResponse.json({ detail: 'Role not found' }, { status: 404 });
        }
        const { permission } = (await request.json()) as { permission: string };
        return HttpResponse.json({ permission });
    }),
];

// Permission Handlers
export const permissionHandlers = [
    http.get('*/api/v1/permissions/', async ({ request }) => {
        const url = new URL(request.url);
        const module = url.searchParams.get('module') || '';
        const category = url.searchParams.get('category') || '';

        let filteredPermissions = [...mockPermissions];

        if (module) {
            filteredPermissions = filteredPermissions.filter((p) => p.module === module);
        }

        if (category) {
            filteredPermissions = filteredPermissions.filter((p) => p.category === category);
        }

        return HttpResponse.json({
            count: filteredPermissions.length,
            results: filteredPermissions,
        });
    }),

    http.get('*/api/v1/permissions/module/:module/', async ({ params }) => {
        const modulePermissions = mockPermissions.filter((p) => p.module === params.module);
        return HttpResponse.json({ permissions: modulePermissions });
    }),

    http.get('*/api/v1/permissions/category/:category/', async ({ params }) => {
        const categoryPermissions = mockPermissions.filter((p) => p.category === params.category);
        return HttpResponse.json({ permissions: categoryPermissions });
    }),

    http.get('*/api/v1/permissions/codes/', async () => {
        const codes = mockPermissions.map((p) => p.code);
        return HttpResponse.json({ codes });
    }),
];

// MFA Handlers
export const mfaHandlers = [
    http.get('*/api/v1/mfa/config/', async () => {
        return HttpResponse.json(mockMFAConfig);
    }),

    http.post('*/api/v1/mfa/totp/setup/', async () => {
        return HttpResponse.json({
            secret: 'JBSWY3DPEHPK3PXP',
            uri: 'otpauth://totp/StudioHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=StudioHub',
            qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        });
    }),

    http.post('*/api/v1/mfa/totp/verify/', async ({ request }) => {
        const { token } = (await request.json()) as { token: string };
        if (token === '123456') {
            return HttpResponse.json({ verified: true, mfa_enabled: true });
        }
        return HttpResponse.json({ verified: false, error: 'Invalid token' }, { status: 400 });
    }),

    http.post('*/api/v1/mfa/totp/disable/', async () => {
        return HttpResponse.json({ mfa_enabled: false, methods: [] });
    }),

    http.post('*/api/v1/mfa/sms/setup/', async () => {
        return HttpResponse.json({ phone_number_required: true });
    }),

    http.post('*/api/v1/mfa/sms/verify/', async ({ request }) => {
        const { code } = (await request.json()) as { code: string };
        if (code === '123456') {
            return HttpResponse.json({ verified: true, mfa_enabled: true });
        }
        return HttpResponse.json({ verified: false, error: 'Invalid code' }, { status: 400 });
    }),

    http.post('*/api/v1/mfa/sms/disable/', async () => {
        return HttpResponse.json({ mfa_enabled: false, methods: [] });
    }),

    http.post('*/api/v1/mfa/email/setup/', async () => {
        return HttpResponse.json({ email_required: true });
    }),

    http.post('*/api/v1/mfa/email/verify/', async ({ request }) => {
        const { code } = (await request.json()) as { code: string };
        if (code === '123456') {
            return HttpResponse.json({ verified: true, mfa_enabled: true });
        }
        return HttpResponse.json({ verified: false, error: 'Invalid code' }, { status: 400 });
    }),

    http.post('*/api/v1/mfa/email/disable/', async () => {
        return HttpResponse.json({ mfa_enabled: false, methods: [] });
    }),

    http.post('*/api/v1/mfa/recovery-codes/', async () => {
        return HttpResponse.json({
            recovery_codes: mockMFAConfig.recovery_codes || [],
        });
    }),

    http.post('*/api/v1/mfa/recovery-codes/regenerate/', async () => {
        return HttpResponse.json({
            recovery_codes: [
                'newcode123abc',
                'newcode456def',
                'newcode789ghi',
                'newcode012jkl',
                'newcode345mno',
            ],
        });
    }),

    http.post('*/api/v1/mfa/admin/reset/:user_id/', async ({ params }) => {
        return HttpResponse.json({ message: `MFA reset for user ${params.user_id}` });
    }),
];

// Session Handlers
export const sessionHandlers = [
    http.get('*/api/v1/sessions/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const user_id = url.searchParams.get('user_id') || '';

        let filteredSessions = [...mockSessions];

        if (user_id) {
            filteredSessions = filteredSessions.filter((s) => s.user_id === user_id);
        }

        const totalCount = filteredSessions.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedSessions = filteredSessions.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedSessions,
        });
    }),

    http.get('*/api/v1/sessions/:id/', async ({ params }) => {
        const session = mockSessions.find((s) => s.id === params.id);
        if (!session) {
            return HttpResponse.json({ detail: 'Session not found' }, { status: 404 });
        }
        return HttpResponse.json(session);
    }),

    http.delete('*/api/v1/sessions/:id/', async ({ params }) => {
        const sessionIndex = mockSessions.findIndex((s) => s.id === params.id);
        if (sessionIndex === -1) {
            return HttpResponse.json({ detail: 'Session not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/sessions/revoke-all/', async () => {
        return HttpResponse.json({ message: 'All sessions revoked' });
    }),

    http.post('*/api/v1/sessions/revoke-other/', async () => {
        return HttpResponse.json({ message: 'All other sessions revoked' });
    }),
];

// Export all identity handlers
export const identityHandlers = [
    ...userHandlers,
    ...roleHandlers,
    ...permissionHandlers,
    ...mfaHandlers,
    ...sessionHandlers,
];
