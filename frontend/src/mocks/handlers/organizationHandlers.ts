import { http, HttpResponse } from 'msw';

// Mock Data for Organization
const mockOrganizations = [
    {
        id: 'org-001',
        name: 'StudioHub VFX',
        slug: 'studiohub-vfx',
        description: 'Premier VFX and animation studio',
        logo: 'https://ui-avatars.com/api/?name=StudioHub+VFX&background=random',
        website: 'https://studiohub.vfx',
        industry: 'Entertainment',
        size: '50-100',
        status: 'active',
        is_active: true,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        settings: {
            default_frame_rate: 24,
            default_resolution: '1920x1080',
            currency: 'USD',
            timezone: 'America/Los_Angeles',
            date_format: 'MM/DD/YYYY',
        },
    },
    {
        id: 'org-002',
        name: 'Creative Studio',
        slug: 'creative-studio',
        description: 'Digital creative agency',
        logo: 'https://ui-avatars.com/api/?name=Creative+Studio&background=random',
        website: 'https://creative.studio',
        industry: 'Advertising',
        size: '10-50',
        status: 'active',
        is_active: true,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
        settings: {
            default_frame_rate: 30,
            default_resolution: '3840x2160',
            currency: 'EUR',
            timezone: 'Europe/Paris',
            date_format: 'DD/MM/YYYY',
        },
    },
];

const mockDepartments = [
    {
        id: 'dept-001',
        name: 'Production',
        slug: 'production',
        description: 'Production management team',
        organization_id: 'org-001',
        manager_id: 'usr-001',
        member_count: 10,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
    {
        id: 'dept-002',
        name: 'Art',
        slug: 'art',
        description: 'Art and design team',
        organization_id: 'org-001',
        manager_id: 'usr-002',
        member_count: 15,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    },
    {
        id: 'dept-003',
        name: 'Technical Direction',
        slug: 'td',
        description: 'Technical direction and pipeline team',
        organization_id: 'org-001',
        manager_id: 'usr-003',
        member_count: 8,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    },
];

const mockTeams = [
    {
        id: 'team-001',
        name: 'Feature Film Team',
        slug: 'feature-film',
        description: 'Main feature film production team',
        organization_id: 'org-001',
        department_id: 'dept-001',
        lead_id: 'usr-001',
        member_count: 20,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
    {
        id: 'team-002',
        name: 'Short Film Team',
        slug: 'short-film',
        description: 'Short film and experimental team',
        organization_id: 'org-001',
        department_id: 'dept-001',
        lead_id: 'usr-002',
        member_count: 10,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    },
];

const mockOffices = [
    {
        id: 'office-001',
        name: 'Main Studio',
        slug: 'main-studio',
        description: 'Primary studio location',
        organization_id: 'org-001',
        address: '123 Main Street, Los Angeles, CA 90001',
        capacity: 100,
        is_active: true,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
    {
        id: 'office-002',
        name: 'Remote',
        slug: 'remote',
        description: 'Remote workers',
        organization_id: 'org-001',
        address: '',
        capacity: 50,
        is_active: true,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    },
];

const mockMemberships = [
    {
        id: 'memb-001',
        user_id: 'usr-001',
        organization_id: 'org-001',
        role: 'admin',
        department_id: 'dept-001',
        team_id: 'team-001',
        office_id: 'office-001',
        is_active: true,
        joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
    {
        id: 'memb-002',
        user_id: 'usr-002',
        organization_id: 'org-001',
        role: 'producer',
        department_id: 'dept-001',
        team_id: 'team-001',
        office_id: 'office-001',
        is_active: true,
        joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    },
    {
        id: 'memb-003',
        user_id: 'usr-003',
        organization_id: 'org-001',
        role: 'artist',
        department_id: 'dept-002',
        team_id: 'team-002',
        office_id: 'office-002',
        is_active: true,
        joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    },
];

const mockInvitations = [
    {
        id: 'inv-001',
        organization_id: 'org-001',
        invited_by_id: 'usr-001',
        email: 'newuser@example.com',
        role: 'artist',
        status: 'pending',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
        id: 'inv-002',
        organization_id: 'org-001',
        invited_by_id: 'usr-001',
        email: 'another@example.com',
        role: 'viewer',
        status: 'accepted',
        accepted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
];

// Organization Handlers
export const organizationHandlers = [
    http.get('*/api/v1/organizations/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';

        let filteredOrgs = [...mockOrganizations];

        if (search) {
            const searchLower = search.toLowerCase();
            filteredOrgs = filteredOrgs.filter(
                (org) =>
                    org.name.toLowerCase().includes(searchLower) ||
                    org.slug.toLowerCase().includes(searchLower)
            );
        }

        if (status) {
            filteredOrgs = filteredOrgs.filter((org) => org.status === status);
        }

        const totalCount = filteredOrgs.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedOrgs = filteredOrgs.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedOrgs,
        });
    }),

    http.get('*/api/v1/organizations/:id/', async ({ params }) => {
        const org = mockOrganizations.find((o) => o.id === params.id);
        if (!org) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        return HttpResponse.json(org);
    }),

    http.post('*/api/v1/organizations/', async ({ request }) => {
        const orgData = (await request.json()) as Record<string, unknown>;
        const newOrg = {
            id: `org-${Date.now().toString().slice(-6)}`,
            ...orgData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return HttpResponse.json(newOrg, { status: 201 });
    }),

    http.put('*/api/v1/organizations/:id/', async ({ params, request }) => {
        const orgData = (await request.json()) as Record<string, unknown>;
        const orgIndex = mockOrganizations.findIndex((o) => o.id === params.id);
        if (orgIndex === -1) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        const updatedOrg = { ...mockOrganizations[orgIndex], ...orgData };
        return HttpResponse.json(updatedOrg);
    }),

    http.patch('*/api/v1/organizations/:id/', async ({ params, request }) => {
        const orgData = (await request.json()) as Record<string, unknown>;
        const orgIndex = mockOrganizations.findIndex((o) => o.id === params.id);
        if (orgIndex === -1) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        const updatedOrg = { ...mockOrganizations[orgIndex], ...orgData };
        return HttpResponse.json(updatedOrg);
    }),

    http.delete('*/api/v1/organizations/:id/', async ({ params }) => {
        const orgIndex = mockOrganizations.findIndex((o) => o.id === params.id);
        if (orgIndex === -1) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/organizations/:id/archive/', async ({ params }) => {
        const orgIndex = mockOrganizations.findIndex((o) => o.id === params.id);
        if (orgIndex === -1) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockOrganizations[orgIndex], status: 'archived', is_active: false });
    }),

    http.post('*/api/v1/organizations/:id/restore/', async ({ params }) => {
        const orgIndex = mockOrganizations.findIndex((o) => o.id === params.id);
        if (orgIndex === -1) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockOrganizations[orgIndex], status: 'active', is_active: true });
    }),

    http.post('*/api/v1/organizations/:id/switch/', async ({ params }) => {
        const org = mockOrganizations.find((o) => o.id === params.id);
        if (!org) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: `Switched to organization ${org.name}` });
    }),

    http.get('*/api/v1/organizations/:id/settings/', async ({ params }) => {
        const org = mockOrganizations.find((o) => o.id === params.id);
        if (!org) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        return HttpResponse.json({ settings: org.settings });
    }),

    http.put('*/api/v1/organizations/:id/settings/', async ({ params, request }) => {
        const settings = (await request.json()) as Record<string, unknown>;
        const orgIndex = mockOrganizations.findIndex((o) => o.id === params.id);
        if (orgIndex === -1) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        return HttpResponse.json({ settings });
    }),

    http.post('*/api/v1/organizations/:id/export/', async ({ params }) => {
        const org = mockOrganizations.find((o) => o.id === params.id);
        if (!org) {
            return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: 'Export started' });
    }),
];

// Department Handlers
export const departmentHandlers = [
    http.get('*/api/v1/departments/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const organization_id = url.searchParams.get('organization_id') || '';
        const search = url.searchParams.get('search') || '';

        let filteredDepts = [...mockDepartments];

        if (organization_id) {
            filteredDepts = filteredDepts.filter((d) => d.organization_id === organization_id);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filteredDepts = filteredDepts.filter((dept) =>
                dept.name.toLowerCase().includes(searchLower) ||
                dept.slug.toLowerCase().includes(searchLower)
            );
        }

        const totalCount = filteredDepts.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedDepts = filteredDepts.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedDepts,
        });
    }),

    http.get('*/api/v1/departments/:id/', async ({ params }) => {
        const dept = mockDepartments.find((d) => d.id === params.id);
        if (!dept) {
            return HttpResponse.json({ detail: 'Department not found' }, { status: 404 });
        }
        return HttpResponse.json(dept);
    }),

    http.post('*/api/v1/departments/', async ({ request }) => {
        const deptData = (await request.json()) as Record<string, unknown>;
        const newDept = {
            id: `dept-${Date.now().toString().slice(-6)}`,
            ...deptData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return HttpResponse.json(newDept, { status: 201 });
    }),

    http.put('*/api/v1/departments/:id/', async ({ params, request }) => {
        const deptData = (await request.json()) as Record<string, unknown>;
        const deptIndex = mockDepartments.findIndex((d) => d.id === params.id);
        if (deptIndex === -1) {
            return HttpResponse.json({ detail: 'Department not found' }, { status: 404 });
        }
        const updatedDept = { ...mockDepartments[deptIndex], ...deptData };
        return HttpResponse.json(updatedDept);
    }),

    http.patch('*/api/v1/departments/:id/', async ({ params, request }) => {
        const deptData = (await request.json()) as Record<string, unknown>;
        const deptIndex = mockDepartments.findIndex((d) => d.id === params.id);
        if (deptIndex === -1) {
            return HttpResponse.json({ detail: 'Department not found' }, { status: 404 });
        }
        const updatedDept = { ...mockDepartments[deptIndex], ...deptData };
        return HttpResponse.json(updatedDept);
    }),

    http.delete('*/api/v1/departments/:id/', async ({ params }) => {
        const deptIndex = mockDepartments.findIndex((d) => d.id === params.id);
        if (deptIndex === -1) {
            return HttpResponse.json({ detail: 'Department not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/departments/:id/archive/', async ({ params }) => {
        const deptIndex = mockDepartments.findIndex((d) => d.id === params.id);
        if (deptIndex === -1) {
            return HttpResponse.json({ detail: 'Department not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockDepartments[deptIndex], is_active: false });
    }),

    http.get('*/api/v1/departments/:id/members/', async ({ params }) => {
        const dept = mockDepartments.find((d) => d.id === params.id);
        if (!dept) {
            return HttpResponse.json({ detail: 'Department not found' }, { status: 404 });
        }
        return HttpResponse.json({
            count: dept.member_count,
            results: mockMemberships.filter((m) => m.department_id === dept.id),
        });
    }),
];

// Team Handlers
export const teamHandlers = [
    http.get('*/api/v1/teams/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const organization_id = url.searchParams.get('organization_id') || '';
        const department_id = url.searchParams.get('department_id') || '';
        const search = url.searchParams.get('search') || '';

        let filteredTeams = [...mockTeams];

        if (organization_id) {
            filteredTeams = filteredTeams.filter((t) => t.organization_id === organization_id);
        }

        if (department_id) {
            filteredTeams = filteredTeams.filter((t) => t.department_id === department_id);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filteredTeams = filteredTeams.filter((team) =>
                team.name.toLowerCase().includes(searchLower) ||
                team.slug.toLowerCase().includes(searchLower)
            );
        }

        const totalCount = filteredTeams.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedTeams = filteredTeams.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedTeams,
        });
    }),

    http.get('*/api/v1/teams/:id/', async ({ params }) => {
        const team = mockTeams.find((t) => t.id === params.id);
        if (!team) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        return HttpResponse.json(team);
    }),

    http.post('*/api/v1/teams/', async ({ request }) => {
        const teamData = (await request.json()) as Record<string, unknown>;
        const newTeam = {
            id: `team-${Date.now().toString().slice(-6)}`,
            ...teamData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return HttpResponse.json(newTeam, { status: 201 });
    }),

    http.put('*/api/v1/teams/:id/', async ({ params, request }) => {
        const teamData = (await request.json()) as Record<string, unknown>;
        const teamIndex = mockTeams.findIndex((t) => t.id === params.id);
        if (teamIndex === -1) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        const updatedTeam = { ...mockTeams[teamIndex], ...teamData };
        return HttpResponse.json(updatedTeam);
    }),

    http.patch('*/api/v1/teams/:id/', async ({ params, request }) => {
        const teamData = (await request.json()) as Record<string, unknown>;
        const teamIndex = mockTeams.findIndex((t) => t.id === params.id);
        if (teamIndex === -1) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        const updatedTeam = { ...mockTeams[teamIndex], ...teamData };
        return HttpResponse.json(updatedTeam);
    }),

    http.delete('*/api/v1/teams/:id/', async ({ params }) => {
        const teamIndex = mockTeams.findIndex((t) => t.id === params.id);
        if (teamIndex === -1) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/teams/:id/archive/', async ({ params }) => {
        const teamIndex = mockTeams.findIndex((t) => t.id === params.id);
        if (teamIndex === -1) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockTeams[teamIndex], is_active: false });
    }),

    http.post('*/api/v1/teams/:id/transfer-ownership/', async ({ params, request }) => {
        const { user_id } = (await request.json()) as { user_id: string };
        const teamIndex = mockTeams.findIndex((t) => t.id === params.id);
        if (teamIndex === -1) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: `Ownership transferred to user ${user_id}` });
    }),

    http.get('*/api/v1/teams/:id/members/', async ({ params }) => {
        const team = mockTeams.find((t) => t.id === params.id);
        if (!team) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        return HttpResponse.json({
            count: team.member_count,
            results: mockMemberships.filter((m) => m.team_id === team.id),
        });
    }),

    http.post('*/api/v1/teams/:id/members/add/', async ({ params, request }) => {
        const { user_id } = (await request.json()) as { user_id: string };
        const teamIndex = mockTeams.findIndex((t) => t.id === params.id);
        if (teamIndex === -1) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: `User ${user_id} added to team` });
    }),

    http.post('*/api/v1/teams/:id/members/remove/', async ({ params, request }) => {
        const { user_id } = (await request.json()) as { user_id: string };
        const teamIndex = mockTeams.findIndex((t) => t.id === params.id);
        if (teamIndex === -1) {
            return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: `User ${user_id} removed from team` });
    }),
];

// Office Handlers
export const officeHandlers = [
    http.get('*/api/v1/offices/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const organization_id = url.searchParams.get('organization_id') || '';
        const search = url.searchParams.get('search') || '';

        let filteredOffices = [...mockOffices];

        if (organization_id) {
            filteredOffices = filteredOffices.filter((o) => o.organization_id === organization_id);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filteredOffices = filteredOffices.filter((office) =>
                office.name.toLowerCase().includes(searchLower) ||
                office.slug.toLowerCase().includes(searchLower)
            );
        }

        const totalCount = filteredOffices.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedOffices = filteredOffices.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedOffices,
        });
    }),

    http.get('*/api/v1/offices/:id/', async ({ params }) => {
        const office = mockOffices.find((o) => o.id === params.id);
        if (!office) {
            return HttpResponse.json({ detail: 'Office not found' }, { status: 404 });
        }
        return HttpResponse.json(office);
    }),

    http.post('*/api/v1/offices/', async ({ request }) => {
        const officeData = (await request.json()) as Record<string, unknown>;
        const newOffice = {
            id: `office-${Date.now().toString().slice(-6)}`,
            ...officeData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return HttpResponse.json(newOffice, { status: 201 });
    }),

    http.put('*/api/v1/offices/:id/', async ({ params, request }) => {
        const officeData = (await request.json()) as Record<string, unknown>;
        const officeIndex = mockOffices.findIndex((o) => o.id === params.id);
        if (officeIndex === -1) {
            return HttpResponse.json({ detail: 'Office not found' }, { status: 404 });
        }
        const updatedOffice = { ...mockOffices[officeIndex], ...officeData };
        return HttpResponse.json(updatedOffice);
    }),

    http.patch('*/api/v1/offices/:id/', async ({ params, request }) => {
        const officeData = (await request.json()) as Record<string, unknown>;
        const officeIndex = mockOffices.findIndex((o) => o.id === params.id);
        if (officeIndex === -1) {
            return HttpResponse.json({ detail: 'Office not found' }, { status: 404 });
        }
        const updatedOffice = { ...mockOffices[officeIndex], ...officeData };
        return HttpResponse.json(updatedOffice);
    }),

    http.delete('*/api/v1/offices/:id/', async ({ params }) => {
        const officeIndex = mockOffices.findIndex((o) => o.id === params.id);
        if (officeIndex === -1) {
            return HttpResponse.json({ detail: 'Office not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/offices/:id/archive/', async ({ params }) => {
        const officeIndex = mockOffices.findIndex((o) => o.id === params.id);
        if (officeIndex === -1) {
            return HttpResponse.json({ detail: 'Office not found' }, { status: 404 });
        }
        return HttpResponse.json({ ...mockOffices[officeIndex], is_active: false });
    }),
];

// Membership Handlers
export const membershipHandlers = [
    http.get('*/api/v1/memberships/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const organization_id = url.searchParams.get('organization_id') || '';
        const user_id = url.searchParams.get('user_id') || '';
        const search = url.searchParams.get('search') || '';

        let filteredMemberships = [...mockMemberships];

        if (organization_id) {
            filteredMemberships = filteredMemberships.filter(
                (m) => m.organization_id === organization_id
            );
        }

        if (user_id) {
            filteredMemberships = filteredMemberships.filter((m) => m.user_id === user_id);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filteredMemberships = filteredMemberships.filter(
                (m) =>
                    m.user_id.toLowerCase().includes(searchLower) ||
                    m.role.toLowerCase().includes(searchLower)
            );
        }

        const totalCount = filteredMemberships.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedMemberships = filteredMemberships.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedMemberships,
        });
    }),

    http.get('*/api/v1/memberships/:id/', async ({ params }) => {
        const membership = mockMemberships.find((m) => m.id === params.id);
        if (!membership) {
            return HttpResponse.json({ detail: 'Membership not found' }, { status: 404 });
        }
        return HttpResponse.json(membership);
    }),

    http.post('*/api/v1/memberships/', async ({ request }) => {
        const membershipData = (await request.json()) as Record<string, unknown>;
        const newMembership = {
            id: `memb-${Date.now().toString().slice(-6)}`,
            ...membershipData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return HttpResponse.json(newMembership, { status: 201 });
    }),

    http.put('*/api/v1/memberships/:id/', async ({ params, request }) => {
        const membershipData = (await request.json()) as Record<string, unknown>;
        const membershipIndex = mockMemberships.findIndex((m) => m.id === params.id);
        if (membershipIndex === -1) {
            return HttpResponse.json({ detail: 'Membership not found' }, { status: 404 });
        }
        const updatedMembership = { ...mockMemberships[membershipIndex], ...membershipData };
        return HttpResponse.json(updatedMembership);
    }),

    http.patch('*/api/v1/memberships/:id/', async ({ params, request }) => {
        const membershipData = (await request.json()) as Record<string, unknown>;
        const membershipIndex = mockMemberships.findIndex((m) => m.id === params.id);
        if (membershipIndex === -1) {
            return HttpResponse.json({ detail: 'Membership not found' }, { status: 404 });
        }
        const updatedMembership = { ...mockMemberships[membershipIndex], ...membershipData };
        return HttpResponse.json(updatedMembership);
    }),

    http.delete('*/api/v1/memberships/:id/', async ({ params }) => {
        const membershipIndex = mockMemberships.findIndex((m) => m.id === params.id);
        if (membershipIndex === -1) {
            return HttpResponse.json({ detail: 'Membership not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/memberships/bulk-update/', async ({ request }) => {
        const { memberships } = (await request.json()) as { memberships: Array<{ id: string; role: string }> };
        return HttpResponse.json({ message: `Updated ${memberships.length} memberships` });
    }),
];

// Invitation Handlers
export const invitationHandlers = [
    http.get('*/api/v1/invitations/', async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('page_size') || '20');
        const organization_id = url.searchParams.get('organization_id') || '';
        const status = url.searchParams.get('status') || '';
        const search = url.searchParams.get('search') || '';

        let filteredInvitations = [...mockInvitations];

        if (organization_id) {
            filteredInvitations = filteredInvitations.filter(
                (i) => i.organization_id === organization_id
            );
        }

        if (status) {
            filteredInvitations = filteredInvitations.filter((i) => i.status === status);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filteredInvitations = filteredInvitations.filter(
                (inv) => inv.email.toLowerCase().includes(searchLower)
            );
        }

        const totalCount = filteredInvitations.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedInvitations = filteredInvitations.slice(startIndex, startIndex + pageSize);

        return HttpResponse.json({
            count: totalCount,
            next: startIndex + pageSize < totalCount ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: paginatedInvitations,
        });
    }),

    http.get('*/api/v1/invitations/:id/', async ({ params }) => {
        const invitation = mockInvitations.find((i) => i.id === params.id);
        if (!invitation) {
            return HttpResponse.json({ detail: 'Invitation not found' }, { status: 404 });
        }
        return HttpResponse.json(invitation);
    }),

    http.post('*/api/v1/invitations/', async ({ request }) => {
        const invitationData = (await request.json()) as Record<string, unknown>;
        const newInvitation = {
            id: `inv-${Date.now().toString().slice(-6)}`,
            ...invitationData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return HttpResponse.json(newInvitation, { status: 201 });
    }),

    http.put('*/api/v1/invitations/:id/', async ({ params, request }) => {
        const invitationData = (await request.json()) as Record<string, unknown>;
        const invitationIndex = mockInvitations.findIndex((i) => i.id === params.id);
        if (invitationIndex === -1) {
            return HttpResponse.json({ detail: 'Invitation not found' }, { status: 404 });
        }
        const updatedInvitation = { ...mockInvitations[invitationIndex], ...invitationData };
        return HttpResponse.json(updatedInvitation);
    }),

    http.patch('*/api/v1/invitations/:id/', async ({ params, request }) => {
        const invitationData = (await request.json()) as Record<string, unknown>;
        const invitationIndex = mockInvitations.findIndex((i) => i.id === params.id);
        if (invitationIndex === -1) {
            return HttpResponse.json({ detail: 'Invitation not found' }, { status: 404 });
        }
        const updatedInvitation = { ...mockInvitations[invitationIndex], ...invitationData };
        return HttpResponse.json(updatedInvitation);
    }),

    http.delete('*/api/v1/invitations/:id/', async ({ params }) => {
        const invitationIndex = mockInvitations.findIndex((i) => i.id === params.id);
        if (invitationIndex === -1) {
            return HttpResponse.json({ detail: 'Invitation not found' }, { status: 404 });
        }
        return HttpResponse.json(null, { status: 204 });
    }),

    http.post('*/api/v1/invitations/:id/resend/', async ({ params }) => {
        const invitationIndex = mockInvitations.findIndex((i) => i.id === params.id);
        if (invitationIndex === -1) {
            return HttpResponse.json({ detail: 'Invitation not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: 'Invitation resent' });
    }),

    http.post('*/api/v1/invitations/:id/accept/', async ({ params }) => {
        const invitationIndex = mockInvitations.findIndex((i) => i.id === params.id);
        if (invitationIndex === -1) {
            return HttpResponse.json({ detail: 'Invitation not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: 'Invitation accepted' });
    }),

    http.post('*/api/v1/invitations/:id/decline/', async ({ params }) => {
        const invitationIndex = mockInvitations.findIndex((i) => i.id === params.id);
        if (invitationIndex === -1) {
            return HttpResponse.json({ detail: 'Invitation not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: 'Invitation declined' });
    }),
];

// Export all organization handlers
export const organizationHandlersList = [
    ...organizationHandlers,
    ...departmentHandlers,
    ...teamHandlers,
    ...officeHandlers,
    ...membershipHandlers,
    ...invitationHandlers,
];
