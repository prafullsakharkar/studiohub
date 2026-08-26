import { http, HttpResponse } from 'msw';
import {
  mockOrganizations,
  mockClients,
  mockVendors,
  mockPeople,
  mockDepartments,
  mockTeams,
  mockOffices,
  mockStudioBilling,
  mockProductionReports,
} from '../db/organization/organization';
import { applyFiltersAndSearch, delay, paginateDRF } from '../utils/mockServerHelpers';
import { Organization, Client, Vendor, Person, DepartmentEntity, Team, Office } from '@/types/organization';

let inMemoryOrganizations = [...mockOrganizations];
let inMemoryClients = [...mockClients];
let inMemoryVendors = [...mockVendors];
let inMemoryPeople = [...mockPeople];
let inMemoryDepartments = [...mockDepartments];
let inMemoryTeams = [...mockTeams];
let inMemoryOffices = [...mockOffices];
let inMemoryBilling = { ...mockStudioBilling };
let inMemoryReports = [...mockProductionReports];

export const organizationHandlers = [
  // ==========================================
  // ORGANIZATIONS
  // ==========================================
  http.get('*/api/v1/organizations/', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryOrganizations, url, ['name', 'code', 'headquarters', 'primary_contact_name']);
    if (url.searchParams.has('page') || url.searchParams.has('page_size')) {
      return HttpResponse.json(paginateDRF(filtered, url, 10));
    }
    return HttpResponse.json(filtered);
  }),

  http.get('*/api/v1/organizations/:id/', async ({ params }) => {
    await delay(120);
    const org = inMemoryOrganizations.find((o) => o.id === params.id || o.code.toLowerCase() === String(params.id).toLowerCase());
    if (!org) {
      return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
    }
    return HttpResponse.json(org);
  }),

  http.post('*/api/v1/organizations/', async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Partial<Organization>;

    if (!body.name || !body.code) {
      return HttpResponse.json(
        {
          name: !body.name ? ['This field is required.'] : undefined,
          code: !body.code ? ['This field is required.'] : undefined,
        },
        { status: 400 }
      );
    }

    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: body.name,
      slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
      code: body.code.toUpperCase(),
      tier: body.tier || 'Studio Pro',
      logo_url: body.logo_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      banner_url: body.banner_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
      headquarters: body.headquarters || 'Vancouver, BC, Canada',
      offices_count: body.offices_count || 1,
      active_projects_count: 0,
      crew_count: body.crew_count || 12,
      storage_quota_tb: body.storage_quota_tb || 250,
      storage_used_tb: 0,
      status: body.status || 'Active',
      primary_contact_name: body.primary_contact_name || 'Studio Administrator',
      primary_contact_email: body.primary_contact_email || 'admin@studio.vfx',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      settings: {
        default_fps: body.settings?.default_fps ?? 24,
        default_color_space: body.settings?.default_color_space ?? 'ACEScg',
        default_resolution: body.settings?.default_resolution ?? '3840x2160 (UHD)',
        allow_guest_reviewers: body.settings?.allow_guest_reviewers ?? true,
        enable_two_factor: body.settings?.enable_two_factor ?? true,
        sso_enforced: body.settings?.sso_enforced ?? false,
        render_farm_region: body.settings?.render_farm_region ?? 'us-west-2 (AWS Farm)',
        usd_schema_version: body.settings?.usd_schema_version ?? 'OpenUSD 24.08',
      },
    };

    inMemoryOrganizations = [newOrg, ...inMemoryOrganizations];
    return HttpResponse.json(newOrg, { status: 201 });
  }),

  http.patch('*/api/v1/organizations/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<Organization>;
    const idx = inMemoryOrganizations.findIndex((o) => o.id === params.id || o.code.toLowerCase() === String(params.id).toLowerCase());
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Organization not found' }, { status: 404 });
    }
    inMemoryOrganizations[idx] = {
      ...inMemoryOrganizations[idx],
      ...body,
      settings: {
        ...inMemoryOrganizations[idx].settings,
        ...(body.settings || {}),
      },
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(inMemoryOrganizations[idx]);
  }),

  http.delete('*/api/v1/organizations/:id/', async ({ params }) => {
    await delay(180);
    inMemoryOrganizations = inMemoryOrganizations.filter((o) => o.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ==========================================
  // CLIENTS
  // ==========================================
  http.get('*/api/v1/clients/', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryClients, url, ['name', 'code', 'contact_name', 'email', 'studio_type']);
    return HttpResponse.json(paginateDRF(filtered, url, 15));
  }),

  http.get('*/api/v1/clients/:id/', async ({ params }) => {
    await delay(120);
    const client = inMemoryClients.find((c) => c.id === params.id || c.code.toLowerCase() === String(params.id).toLowerCase());
    if (!client) return HttpResponse.json({ detail: 'Client not found' }, { status: 404 });
    return HttpResponse.json(client);
  }),

  http.post('*/api/v1/clients/', async ({ request }) => {
    await delay(220);
    const body = (await request.json()) as Partial<Client>;
    if (!body.name) {
      return HttpResponse.json({ name: ['Client studio name is required.'] }, { status: 400 });
    }
    const newClient: Client = {
      id: `cli-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      name: body.name,
      code: (body.code || body.name.substring(0, 3)).toUpperCase(),
      contact_name: body.contact_name || 'Production Lead',
      email: body.email || 'lead@client.com',
      phone: body.phone || '+1 (555) 010-9999',
      studio_type: body.studio_type || 'Major Studio',
      active_projects: body.active_projects || ['NK99 (Neon Knight 2099)'],
      contract_tier: body.contract_tier || 'Standard Producer',
      portal_access: true,
      status: 'Active',
      logo_url: body.logo_url || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=150&auto=format&fit=crop&q=80',
      headquarters: body.headquarters || 'Los Angeles, CA',
      total_billed_usd: body.total_billed_usd || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryClients = [newClient, ...inMemoryClients];
    return HttpResponse.json(newClient, { status: 201 });
  }),

  http.patch('*/api/v1/clients/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<Client>;
    const idx = inMemoryClients.findIndex((c) => c.id === params.id || c.code.toLowerCase() === String(params.id).toLowerCase());
    if (idx === -1) return HttpResponse.json({ detail: 'Client not found' }, { status: 404 });
    inMemoryClients[idx] = { ...inMemoryClients[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(inMemoryClients[idx]);
  }),

  http.delete('*/api/v1/clients/:id/', async ({ params }) => {
    await delay(180);
    inMemoryClients = inMemoryClients.filter((c) => c.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ==========================================
  // VENDORS
  // ==========================================
  http.get('*/api/v1/vendors/', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryVendors, url, ['name', 'code', 'contact_name', 'specialization', 'location']);
    return HttpResponse.json(paginateDRF(filtered, url, 15));
  }),

  http.get('*/api/v1/vendors/:id/', async ({ params }) => {
    await delay(120);
    const vendor = inMemoryVendors.find((v) => v.id === params.id || v.code.toLowerCase() === String(params.id).toLowerCase());
    if (!vendor) return HttpResponse.json({ detail: 'Vendor not found' }, { status: 404 });
    return HttpResponse.json(vendor);
  }),

  http.post('*/api/v1/vendors/', async ({ request }) => {
    await delay(220);
    const body = (await request.json()) as Partial<Vendor>;
    if (!body.name) {
      return HttpResponse.json({ name: ['Vendor facility name is required.'] }, { status: 400 });
    }
    const newVendor: Vendor = {
      id: `ven-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      name: body.name,
      code: (body.code || body.name.substring(0, 3)).toUpperCase(),
      contact_name: body.contact_name || 'Partner Lead',
      email: body.email || 'contact@vendor.com',
      specialization: body.specialization || 'Roto & Paint',
      security_tier: body.security_tier || 'MPAA Certified Tier 4',
      nda_signed: true,
      active_tasks_count: 0,
      active_projects: body.active_projects || ['NK99'],
      rating: 4.8,
      location: body.location || 'Vancouver, BC',
      status: 'Approved Partner',
      logo_url: body.logo_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150&auto=format&fit=crop&q=80',
      bandwidth_gbps: body.bandwidth_gbps || 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryVendors = [newVendor, ...inMemoryVendors];
    return HttpResponse.json(newVendor, { status: 201 });
  }),

  http.patch('*/api/v1/vendors/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<Vendor>;
    const idx = inMemoryVendors.findIndex((v) => v.id === params.id || v.code.toLowerCase() === String(params.id).toLowerCase());
    if (idx === -1) return HttpResponse.json({ detail: 'Vendor not found' }, { status: 404 });
    inMemoryVendors[idx] = { ...inMemoryVendors[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(inMemoryVendors[idx]);
  }),

  http.delete('*/api/v1/vendors/:id/', async ({ params }) => {
    await delay(180);
    inMemoryVendors = inMemoryVendors.filter((v) => v.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ==========================================
  // PEOPLE
  // ==========================================
  http.get('*/api/v1/people/', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryPeople, url, ['full_name', 'email', 'role', 'department_name', 'skills', 'office_name']);
    return HttpResponse.json(paginateDRF(filtered, url, 15));
  }),

  http.get('*/api/v1/people/:id/', async ({ params }) => {
    await delay(120);
    const person = inMemoryPeople.find((p) => p.id === params.id);
    if (!person) return HttpResponse.json({ detail: 'Person not found' }, { status: 404 });
    return HttpResponse.json(person);
  }),

  http.post('*/api/v1/people/', async ({ request }) => {
    await delay(220);
    const body = (await request.json()) as Partial<Person>;
    if (!body.full_name || !body.email) {
      return HttpResponse.json(
        {
          full_name: !body.full_name ? ['Full name is required.'] : undefined,
          email: !body.email ? ['Email is required.'] : undefined,
        },
        { status: 400 }
      );
    }
    const newPerson: Person = {
      id: `usr-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      full_name: body.full_name,
      email: body.email,
      role: body.role || 'Senior Artist',
      department_id: body.department_id || 'dept-02',
      department_name: body.department_name || '3D Modeling & Assets',
      team_id: body.team_id || 'team-02',
      team_name: body.team_name || 'Hero Asset Crew',
      office_id: body.office_id || 'off-01',
      office_name: body.office_name || 'Montreal HQ (Main Stage)',
      avatar_url: body.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      skills: body.skills || ['Maya', 'USD', 'Python'],
      seniority: body.seniority || 'Senior',
      availability_status: body.availability_status || 'Available',
      status: body.status || 'Active',
      assigned_projects: body.assigned_projects || ['NK99'],
      security_clearance: body.security_clearance || 'MPAA Tier 3',
      active_tasks: 0,
      logged_hours: 0,
      phone: body.phone || '+1 (555) 019-2831',
      timezone: body.timezone || 'America/Toronto (EDT)',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryPeople = [newPerson, ...inMemoryPeople];
    return HttpResponse.json(newPerson, { status: 201 });
  }),

  http.patch('*/api/v1/people/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<Person>;
    const idx = inMemoryPeople.findIndex((p) => p.id === params.id);
    if (idx === -1) return HttpResponse.json({ detail: 'Person not found' }, { status: 404 });
    inMemoryPeople[idx] = { ...inMemoryPeople[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(inMemoryPeople[idx]);
  }),

  http.delete('*/api/v1/people/:id/', async ({ params }) => {
    await delay(180);
    inMemoryPeople = inMemoryPeople.filter((p) => p.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ==========================================
  // DEPARTMENTS
  // ==========================================
  http.get('*/api/v1/departments/', async () => {
    await delay(150);
    return HttpResponse.json(inMemoryDepartments);
  }),

  http.get('*/api/v1/departments/:id/', async ({ params }) => {
    await delay(100);
    const dept = inMemoryDepartments.find((d) => d.id === params.id || d.code.toLowerCase() === String(params.id).toLowerCase());
    if (!dept) return HttpResponse.json({ detail: 'Department not found' }, { status: 404 });
    return HttpResponse.json(dept);
  }),

  http.post('*/api/v1/departments/', async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<DepartmentEntity>;
    const newDept: DepartmentEntity = {
      id: `dept-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      name: body.name || 'New Department',
      code: (body.code || 'ND').toUpperCase(),
      head_id: body.head_id || 'usr-001',
      head_name: body.head_name || 'Alex Chen',
      head_avatar: body.head_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      member_count: body.member_count || 1,
      active_tasks_count: 0,
      color: body.color || '#6366f1',
      description: body.description || '',
      software_stack: body.software_stack || ['Maya', 'Houdini', 'OpenUSD'],
      capacity_hours_weekly: body.capacity_hours_weekly || 160,
      utilization_percentage: body.utilization_percentage || 75,
      assigned_projects: body.assigned_projects || ['NK99'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryDepartments = [newDept, ...inMemoryDepartments];
    return HttpResponse.json(newDept, { status: 201 });
  }),

  http.patch('*/api/v1/departments/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<DepartmentEntity>;
    const idx = inMemoryDepartments.findIndex((d) => d.id === params.id || d.code.toLowerCase() === String(params.id).toLowerCase());
    if (idx === -1) return HttpResponse.json({ detail: 'Department not found' }, { status: 404 });
    inMemoryDepartments[idx] = { ...inMemoryDepartments[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(inMemoryDepartments[idx]);
  }),

  http.delete('*/api/v1/departments/:id/', async ({ params }) => {
    await delay(180);
    inMemoryDepartments = inMemoryDepartments.filter((d) => d.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ==========================================
  // TEAMS
  // ==========================================
  http.get('*/api/v1/teams/', async () => {
    await delay(150);
    return HttpResponse.json(inMemoryTeams);
  }),

  http.get('*/api/v1/teams/:id/', async ({ params }) => {
    await delay(100);
    const team = inMemoryTeams.find((t) => t.id === params.id || t.code.toLowerCase() === String(params.id).toLowerCase());
    if (!team) return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
    return HttpResponse.json(team);
  }),

  http.post('*/api/v1/teams/', async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Team>;
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      department_id: body.department_id || 'dept-05',
      department_name: body.department_name || 'FX & Simulation',
      name: body.name || 'New Team Squad',
      code: (body.code || 'NTS').toUpperCase(),
      lead_id: body.lead_id || 'usr-001',
      lead_name: body.lead_name || 'Alex Chen',
      lead_avatar: body.lead_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      member_count: body.member_count || 1,
      member_ids: body.member_ids || ['usr-001'],
      current_project_id: body.current_project_id || 'proj-001',
      current_project_code: body.current_project_code || 'NK99',
      assigned_projects: body.assigned_projects || ['NK99'],
      focus_discipline: body.focus_discipline || 'General Production',
      capacity_utilization: body.capacity_utilization || 80,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryTeams = [newTeam, ...inMemoryTeams];
    return HttpResponse.json(newTeam, { status: 201 });
  }),

  http.patch('*/api/v1/teams/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<Team>;
    const idx = inMemoryTeams.findIndex((t) => t.id === params.id || t.code.toLowerCase() === String(params.id).toLowerCase());
    if (idx === -1) return HttpResponse.json({ detail: 'Team not found' }, { status: 404 });
    inMemoryTeams[idx] = { ...inMemoryTeams[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(inMemoryTeams[idx]);
  }),

  http.delete('*/api/v1/teams/:id/', async ({ params }) => {
    await delay(180);
    inMemoryTeams = inMemoryTeams.filter((t) => t.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ==========================================
  // OFFICES
  // ==========================================
  http.get('*/api/v1/offices/', async () => {
    await delay(150);
    return HttpResponse.json(inMemoryOffices);
  }),

  http.get('*/api/v1/offices/:id/', async ({ params }) => {
    await delay(100);
    const office = inMemoryOffices.find((o) => o.id === params.id || o.code.toLowerCase() === String(params.id).toLowerCase());
    if (!office) return HttpResponse.json({ detail: 'Office not found' }, { status: 404 });
    return HttpResponse.json(office);
  }),

  http.post('*/api/v1/offices/', async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Office>;
    const newOffice: Office = {
      id: `off-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      name: body.name || 'New Facility Hub',
      code: (body.code || 'NFH').toUpperCase(),
      city: body.city || 'Vancouver',
      country: body.country || 'Canada',
      address: body.address || '100 Studio Way',
      timezone: body.timezone || 'America/Vancouver (PST)',
      capacity: body.capacity || 100,
      current_occupancy: body.current_occupancy || 10,
      manager_id: body.manager_id || 'usr-001',
      manager_name: body.manager_name || 'Alex Chen',
      network_speed_gbps: body.network_speed_gbps || 50,
      color_space: body.color_space || 'ACEScg',
      status: body.status || 'Operational',
      working_hours: body.working_hours || '09:00 - 18:00 (Mon-Fri)',
      holidays: body.holidays || [
        { name: "New Year's Day", date: '2026-01-01', type: 'National' },
        { name: 'Studio Summer Break', date: '2026-07-01', type: 'Studio Holiday' },
      ],
      resources: body.resources || ['4K HDR Grading Suite', '10Gbps Fiber Uplink'],
      assigned_projects: body.assigned_projects || ['NK99'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryOffices = [newOffice, ...inMemoryOffices];
    return HttpResponse.json(newOffice, { status: 201 });
  }),

  http.patch('*/api/v1/offices/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<Office>;
    const idx = inMemoryOffices.findIndex((o) => o.id === params.id || o.code.toLowerCase() === String(params.id).toLowerCase());
    if (idx === -1) return HttpResponse.json({ detail: 'Office not found' }, { status: 404 });
    inMemoryOffices[idx] = { ...inMemoryOffices[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(inMemoryOffices[idx]);
  }),

  http.delete('*/api/v1/offices/:id/', async ({ params }) => {
    await delay(180);
    inMemoryOffices = inMemoryOffices.filter((o) => o.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ==========================================
  // BILLING & REPORTS
  // ==========================================
  http.get('*/api/v1/billing/', async () => {
    await delay(150);
    return HttpResponse.json(inMemoryBilling);
  }),

  http.get('*/api/v1/reports/', async () => {
    await delay(150);
    return HttpResponse.json(inMemoryReports);
  }),
];
