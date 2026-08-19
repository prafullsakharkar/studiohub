import { mockUsers } from './db/identity/users';
import { mockProjects, Project } from './db/production/projects';
import { mockShots, Shot } from './db/production/shots';
import { mockAssets, Asset } from './db/assets/assets';
import { mockTasks, Task } from './db/tasks/tasks';
import { mockReviews, ReviewSession, ReviewAnnotation } from './db/reviews/reviews';
import { mockAuditLogs, AuditLog } from './db/audit/auditLogs';
import { mockProductionKpis, mockDepartmentProgress } from './db/analytics/metrics';
import {
  mockOrganizations,
  mockClients,
  mockVendors,
  mockPeople,
  mockDepartments,
  mockTeams,
  mockOffices,
  mockPublishedVersions,
  mockStudioBilling,
  mockStudioNotifications,
  mockProductionReports,
} from './db/organization/organization';
import { mockPipelineSettings, PipelineSettings } from './db/settings/settings';
import { applyFiltersAndSearch, delay, paginateDRF } from './utils/mockServerHelpers';
import { ApiError } from '@/api/errors/ApiError';
import { tokenStorage } from '@/core/auth/tokenStorage';
import {
  Organization,
  Client,
  Vendor,
  Person,
  DepartmentEntity,
  Team,
  Office,
  PublishedVersion,
  StudioNotification,
  ProductionReport,
} from '@/types/organization';

// In-memory writable stores
let inMemoryProjects = [...mockProjects];
let inMemoryShots = [...mockShots];
let inMemoryAssets = [...mockAssets];
let inMemoryTasks = [...mockTasks];
let inMemoryReviews = [...mockReviews];
let inMemoryAuditLogs = [...mockAuditLogs];
let inMemorySettings = { ...mockPipelineSettings };

let inMemoryOrganizations = [...mockOrganizations];
let inMemoryClients = [...mockClients];
let inMemoryVendors = [...mockVendors];
let inMemoryPeople = [...mockPeople];
let inMemoryDepartments = [...mockDepartments];
let inMemoryTeams = [...mockTeams];
let inMemoryOffices = [...mockOffices];
let inMemoryVersions = [...mockPublishedVersions];
let inMemoryNotifications = [...mockStudioNotifications];
let inMemoryBilling = { ...mockStudioBilling };
let inMemoryReports = [...mockProductionReports];

export interface MockResponse<T = any> {
  status: number;
  data: T;
}

/**
 * In-memory Mock REST Router
 * Intercepts all DRF /api/v1/* requests and executes them against in-memory models.
 * Completely immune to ServiceWorker sandboxing / iframe restrictions.
 */
export async function dispatchMockRequest<T = any>(
  method: string,
  urlPath: string,
  body?: any,
  params?: Record<string, any>
): Promise<MockResponse<T> | null> {
  // Normalize URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  let fullUrl: URL;
  try {
    fullUrl = new URL(urlPath, origin);
  } catch {
    fullUrl = new URL(`http://localhost:3000${urlPath.startsWith('/') ? '' : '/'}${urlPath}`);
  }

  // Attach search parameters
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        fullUrl.searchParams.set(key, String(val));
      }
    });
  }

  const pathname = fullUrl.pathname.replace(/\/+$/, '') + '/';
  const normMethod = method.toUpperCase();

  // Only handle /api/
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  await delay(120);

  // ----------------------------------------------------
  // AUTHENTICATION ENDPOINTS
  // ----------------------------------------------------
  if (pathname === '/api/v1/auth/login/' && normMethod === 'POST') {
    const { email, password } = body || {};
    const user = mockUsers.find((u) => u.email.toLowerCase() === email?.toLowerCase());

    if (!user) {
      throw ApiError.fromDrfResponse(401, { detail: 'No active account found with the given email' });
    }

    if (!password || (password !== 'password123' && password !== 'admin' && password.length < 6)) {
      throw ApiError.fromDrfResponse(400, { detail: 'Invalid credentials. (Hint: use password123)' });
    }

    const accessToken = `jwt_acc_${user.id}_${Date.now()}`;
    const refreshToken = `jwt_ref_${user.id}_${Date.now()}`;

    return {
      status: 200,
      data: {
        tokens: {
          access: accessToken,
          refresh: refreshToken,
        },
        user,
      } as unknown as T,
    };
  }

  if (pathname === '/api/v1/auth/refresh/' && normMethod === 'POST') {
    const { refresh } = body || {};
    if (!refresh) {
      throw ApiError.fromDrfResponse(400, { detail: 'Refresh token is required' });
    }
    const newAccessToken = `jwt_acc_refreshed_${Date.now()}`;
    return {
      status: 200,
      data: { access: newAccessToken } as unknown as T,
    };
  }

  if (pathname === '/api/v1/auth/logout/' && normMethod === 'POST') {
    return {
      status: 200,
      data: { detail: 'Successfully logged out' } as unknown as T,
    };
  }

  if (pathname === '/api/v1/auth/me/' && normMethod === 'GET') {
    const token = tokenStorage.getAccessToken();
    const user = (token ? mockUsers.find((u) => token.includes(u.id)) : null) || mockUsers[0];
    return {
      status: 200,
      data: user as unknown as T,
    };
  }

  // ----------------------------------------------------
  // PROJECTS
  // ----------------------------------------------------
  if (pathname === '/api/v1/projects/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryProjects, fullUrl, ['name', 'code', 'description', 'client_name']);
    const paginated = paginateDRF(filtered, fullUrl);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.startsWith('/api/v1/projects/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/projects/', '').replace('/', '');
    const project = inMemoryProjects.find((p) => p.id === id);
    if (!project) {
      throw ApiError.fromDrfResponse(404, { detail: 'Project not found' });
    }
    return { status: 200, data: project as unknown as T };
  }

  if (pathname === '/api/v1/projects/' && normMethod === 'POST') {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: body.name || 'Untitled Project',
      code: (body.code || 'PROJ').toUpperCase(),
      type: body.type || 'Feature Film',
      description: body.description || '',
      status: body.status || 'In Progress',
      fps: body.fps || 24,
      resolution: body.resolution || '4096x2160 (4K DCI)',
      aspect_ratio: body.aspect_ratio || '2.39:1',
      color_space: body.color_space || 'ACEScg',
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      delivery_date: body.delivery_date || '2027-01-01',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      total_shots: body.total_shots || 0,
      approved_shots: 0,
      in_progress_shots: 0,
      total_assets: 0,
      budget_usd: body.budget_usd || 1000000,
      supervisor_id: body.supervisor_id || 'usr-001',
      supervisor_name: body.supervisor_name || 'Alex Chen',
      coordinator_id: body.coordinator_id || 'usr-002',
      coordinator_name: body.coordinator_name || 'Marcus Vance',
      client_name: body.client_name || 'Warner Nexus Studios',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryProjects = [newProject, ...inMemoryProjects];
    return { status: 201, data: newProject as unknown as T };
  }

  if (pathname.startsWith('/api/v1/projects/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/projects/', '').replace('/', '');
    const idx = inMemoryProjects.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Project not found' });
    }
    inMemoryProjects[idx] = {
      ...inMemoryProjects[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryProjects[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/projects/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/projects/', '').replace('/', '');
    inMemoryProjects = inMemoryProjects.filter((p) => p.id !== id);
    return { status: 204, data: {} as unknown as T };
  }

  // ----------------------------------------------------
  // SHOTS
  // ----------------------------------------------------
  if (pathname === '/api/v1/shots/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryShots, fullUrl, ['code', 'name', 'description', 'sequence_code', 'assigned_artist_name']);
    const paginated = paginateDRF(filtered, fullUrl);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.includes('/approve') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/shots\/([^/]+)\/approve/);
    const id = match ? match[1] : '';
    const idx = inMemoryShots.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Shot not found' });
    }
    inMemoryShots[idx] = {
      ...inMemoryShots[idx],
      status: 'Approved',
      supervisor_approved: true,
      pipeline: {
        layout: 'Approved',
        animation: 'Approved',
        fx: 'Approved',
        lighting: 'Approved',
        comp: 'Approved',
      },
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryShots[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/shots/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/shots/', '').replace('/', '');
    const shot = inMemoryShots.find((s) => s.id === id);
    if (!shot) {
      throw ApiError.fromDrfResponse(404, { detail: 'Shot not found' });
    }
    return { status: 200, data: shot as unknown as T };
  }

  if (pathname === '/api/v1/shots/' && normMethod === 'POST') {
    const newShot: Shot = {
      id: `shot-${Date.now()}`,
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      sequence_code: body.sequence_code || 'NK_010',
      code: body.code || `NK_${Math.floor(Math.random() * 900 + 100)}`,
      name: body.name || 'Untitled Shot',
      description: body.description || '',
      status: body.status || 'Not Started',
      frame_in: body.frame_in || 1001,
      frame_out: body.frame_out || 1120,
      frame_count: (body.frame_out || 1120) - (body.frame_in || 1001),
      handle_frames: body.handle_frames || 8,
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
      video_url: body.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      current_version: 'v001',
      assigned_artist_id: body.assigned_artist_id,
      assigned_artist_name: body.assigned_artist_name || 'Sarah Jenkins',
      supervisor_approved: false,
      client_approved: false,
      pipeline: {
        layout: 'Not Started',
        animation: 'Not Started',
        fx: 'Not Started',
        lighting: 'Not Started',
        comp: 'Not Started',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryShots = [newShot, ...inMemoryShots];
    return { status: 201, data: newShot as unknown as T };
  }

  if (pathname.startsWith('/api/v1/shots/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/shots/', '').replace('/', '');
    const idx = inMemoryShots.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Shot not found' });
    }
    inMemoryShots[idx] = {
      ...inMemoryShots[idx],
      ...body,
      pipeline: {
        ...inMemoryShots[idx].pipeline,
        ...(body.pipeline || {}),
      },
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryShots[idx] as unknown as T };
  }

  // ----------------------------------------------------
  // ASSETS
  // ----------------------------------------------------
  if (pathname === '/api/v1/assets/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryAssets, fullUrl, ['name', 'code', 'category', 'description', 'assigned_artist_name']);
    const paginated = paginateDRF(filtered, fullUrl);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.startsWith('/api/v1/assets/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/assets/', '').replace('/', '');
    const asset = inMemoryAssets.find((a) => a.id === id);
    if (!asset) {
      throw ApiError.fromDrfResponse(404, { detail: 'Asset not found' });
    }
    return { status: 200, data: asset as unknown as T };
  }

  if (pathname === '/api/v1/assets/' && normMethod === 'POST') {
    const newAsset: Asset = {
      id: `ast-${Date.now()}`,
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      name: body.name || 'New Asset',
      code: body.code || `AST_${Math.floor(Math.random() * 9000 + 1000)}`,
      category: body.category || 'Prop',
      description: body.description || '',
      status: body.status || 'Not Started',
      version: 'v001',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
      file_format: body.file_format || 'USD / Alembic (.abc)',
      poly_count: body.poly_count || 500000,
      lod_levels: body.lod_levels || 3,
      assigned_artist_id: body.assigned_artist_id,
      assigned_artist_name: body.assigned_artist_name || 'Sarah Jenkins',
      software: body.software || 'Maya',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryAssets = [newAsset, ...inMemoryAssets];
    return { status: 201, data: newAsset as unknown as T };
  }

  if (pathname.startsWith('/api/v1/assets/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/assets/', '').replace('/', '');
    const idx = inMemoryAssets.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Asset not found' });
    }
    inMemoryAssets[idx] = {
      ...inMemoryAssets[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryAssets[idx] as unknown as T };
  }

  // ----------------------------------------------------
  // TASKS
  // ----------------------------------------------------
  if (pathname === '/api/v1/tasks/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryTasks, fullUrl, ['title', 'code', 'entity_code', 'assignee_name', 'department']);
    const paginated = paginateDRF(filtered, fullUrl);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.startsWith('/api/v1/tasks/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/tasks/', '').replace('/', '');
    const task = inMemoryTasks.find((t) => t.id === id);
    if (!task) {
      throw ApiError.fromDrfResponse(404, { detail: 'Task not found' });
    }
    return { status: 200, data: task as unknown as T };
  }

  if (pathname === '/api/v1/tasks/' && normMethod === 'POST') {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: body.title || 'Untitled Task',
      code: body.code || `TSK-${Math.floor(Math.random() * 9000 + 1000)}`,
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_010',
      department: body.department || 'FX & Simulation',
      status: body.status || ('Not Started' as any),
      priority: body.priority || 'Medium',
      assignee_id: body.assignee_id,
      assignee_name: body.assignee_name || 'Elena Rostova',
      assignee_avatar: body.assignee_avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      reviewer_id: 'usr-001',
      reviewer_name: 'Alex Chen',
      due_date: body.due_date || '2026-09-01',
      estimated_hours: body.estimated_hours || 24,
      logged_hours: body.logged_hours || 0,
      description: body.description || '',
      software: body.software || 'Houdini 20.5',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryTasks = [newTask, ...inMemoryTasks];
    return { status: 201, data: newTask as unknown as T };
  }

  if (pathname.startsWith('/api/v1/tasks/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/tasks/', '').replace('/', '');
    const idx = inMemoryTasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Task not found' });
    }
    inMemoryTasks[idx] = {
      ...inMemoryTasks[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryTasks[idx] as unknown as T };
  }

  // ----------------------------------------------------
  // REVIEWS & SCREENING
  // ----------------------------------------------------
  if (pathname === '/api/v1/reviews/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryReviews, fullUrl, ['title', 'code', 'entity_code', 'lead_reviewer_name']);
    const paginated = paginateDRF(filtered, fullUrl);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.includes('/annotations') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/annotations/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    }
    const newAnnotation: ReviewAnnotation = {
      id: `ann-${Date.now()}`,
      frame_number: body.frame_number || 1,
      timecode: body.timecode || '01:00:00:00',
      author_name: body.author_name || 'Alex Chen (Supervisor)',
      comment: body.comment || '',
      drawing_coordinates: body.drawing_coordinates,
      created_at: new Date().toISOString(),
    };
    inMemoryReviews[idx].annotations.push(newAnnotation);
    inMemoryReviews[idx].updated_at = new Date().toISOString();
    return { status: 201, data: newAnnotation as unknown as T };
  }

  if (pathname.includes('/verdict') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/verdict/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    }
    inMemoryReviews[idx] = {
      ...inMemoryReviews[idx],
      status: body.verdict === 'Approved' ? 'Approved' : body.verdict === 'Retake' ? 'Retake' : 'Pending Review',
      supervisor_verdict: body.verdict,
      supervisor_notes: body.notes || inMemoryReviews[idx].supervisor_notes,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/reviews/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/reviews/', '').replace('/', '');
    const review = inMemoryReviews.find((r) => r.id === id);
    if (!review) {
      throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    }
    return { status: 200, data: review as unknown as T };
  }

  // ----------------------------------------------------
  // AUDIT
  // ----------------------------------------------------
  if (pathname === '/api/v1/audit/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryAuditLogs, fullUrl, ['user_name', 'user_email', 'action', 'entity_type', 'entity_code', 'description']);
    const paginated = paginateDRF(filtered, fullUrl, 15);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname === '/api/v1/audit/' && normMethod === 'POST') {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      user_id: body.user_id || 'usr-001',
      user_name: body.user_name || 'Alex Chen',
      user_email: body.user_email || 'supervisor@studiohub.vfx',
      action: body.action || 'UPDATE',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_010',
      description: body.description || 'Action performed in StudioHub.',
      ip_address: '192.168.10.45',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryAuditLogs = [newLog, ...inMemoryAuditLogs];
    return { status: 201, data: newLog as unknown as T };
  }

  // ----------------------------------------------------
  // ORGANIZATIONS & PLATFORM ENTITIES
  // ----------------------------------------------------
  if (pathname === '/api/v1/organizations/' && normMethod === 'GET') {
    let filtered = [...inMemoryOrganizations];
    const search = fullUrl.searchParams.get('search');
    const status = fullUrl.searchParams.get('status');
    const tier = fullUrl.searchParams.get('tier');
    const location = fullUrl.searchParams.get('location');
    const ordering = fullUrl.searchParams.get('ordering');

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.code.toLowerCase().includes(q) ||
          o.headquarters.toLowerCase().includes(q) ||
          o.primary_contact_name.toLowerCase().includes(q)
      );
    }

    if (status && status !== 'ALL') {
      filtered = filtered.filter((o) => o.status.toLowerCase() === status.toLowerCase());
    }

    if (tier && tier !== 'ALL') {
      filtered = filtered.filter((o) => o.tier === tier);
    }

    if (location && location !== 'ALL') {
      filtered = filtered.filter((o) => o.headquarters.toLowerCase().includes(location.toLowerCase()));
    }

    if (ordering) {
      const isDesc = ordering.startsWith('-');
      const field = isDesc ? ordering.substring(1) : ordering;
      filtered.sort((a: any, b: any) => {
        let valA = a[field] ?? '';
        let valB = b[field] ?? '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return isDesc ? 1 : -1;
        if (valA > valB) return isDesc ? -1 : 1;
        return 0;
      });
    }

    // Check if client requested paginated format
    if (fullUrl.searchParams.has('page') || fullUrl.searchParams.has('page_size')) {
      const paginated = paginateDRF(filtered, fullUrl, 10);
      return { status: 200, data: paginated as unknown as T };
    }

    return { status: 200, data: filtered as unknown as T };
  }

  if (pathname === '/api/v1/organizations/' && normMethod === 'POST') {
    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: body.name || 'New Studio Entity',
      slug: body.slug || (body.name || 'new-studio').toLowerCase().replace(/\s+/g, '-'),
      code: body.code ? body.code.toUpperCase() : 'NEW',
      tier: body.tier || 'Studio Pro',
      logo_url:
        body.logo_url ||
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      banner_url:
        body.banner_url ||
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
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
    return { status: 201, data: newOrg as unknown as T };
  }

  if (pathname.startsWith('/api/v1/organizations/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/organizations/', '').replace('/', '');
    const org = inMemoryOrganizations.find((o) => o.id === id || o.code.toLowerCase() === id.toLowerCase());
    if (!org) throw ApiError.fromDrfResponse(404, { detail: 'Organization not found' });
    return { status: 200, data: org as unknown as T };
  }

  if (pathname.startsWith('/api/v1/organizations/') && (normMethod === 'PUT' || normMethod === 'PATCH')) {
    const id = pathname.replace('/api/v1/organizations/', '').replace('/', '');
    const index = inMemoryOrganizations.findIndex((o) => o.id === id || o.code.toLowerCase() === id.toLowerCase());
    if (index === -1) throw ApiError.fromDrfResponse(404, { detail: 'Organization not found' });

    const existing = inMemoryOrganizations[index];
    const updated: Organization = {
      ...existing,
      ...body,
      settings: {
        ...existing.settings,
        ...(body.settings || {}),
      },
      updated_at: new Date().toISOString(),
    };
    inMemoryOrganizations[index] = updated;
    return { status: 200, data: updated as unknown as T };
  }

  if (pathname.startsWith('/api/v1/organizations/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/organizations/', '').replace('/', '');
    const exists = inMemoryOrganizations.some((o) => o.id === id);
    if (!exists) throw ApiError.fromDrfResponse(404, { detail: 'Organization not found' });
    inMemoryOrganizations = inMemoryOrganizations.filter((o) => o.id !== id);
    return { status: 204, data: null as unknown as T };
  }

  // CLIENTS
  if (pathname === '/api/v1/clients/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryClients, fullUrl, ['name', 'code', 'contact_name', 'email', 'studio_type']);
    const paginated = paginateDRF(filtered, fullUrl, 15);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname === '/api/v1/clients/' && normMethod === 'POST') {
    const newClient: Client = {
      id: `cli-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      name: body.name || 'New Client Studio',
      code: body.code || 'NCS',
      contact_name: body.contact_name || 'Production Lead',
      email: body.email || 'lead@client.com',
      phone: body.phone || '+1 (555) 010-9999',
      studio_type: body.studio_type || 'Major Studio',
      active_projects: body.active_projects || ['NK99'],
      contract_tier: body.contract_tier || 'Standard Producer',
      portal_access: true,
      status: 'Active',
      logo_url: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=150&auto=format&fit=crop&q=80',
      headquarters: body.headquarters || 'Los Angeles, CA',
      total_billed_usd: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryClients = [newClient, ...inMemoryClients];
    return { status: 201, data: newClient as unknown as T };
  }

  // VENDORS
  if (pathname === '/api/v1/vendors/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryVendors, fullUrl, ['name', 'code', 'contact_name', 'specialization', 'location']);
    const paginated = paginateDRF(filtered, fullUrl, 15);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname === '/api/v1/vendors/' && normMethod === 'POST') {
    const newVendor: Vendor = {
      id: `ven-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      name: body.name || 'New Partner Lab',
      code: body.code || 'NPL',
      contact_name: body.contact_name || 'Partner Supervisor',
      email: body.email || 'contact@partnerlab.com',
      specialization: body.specialization || 'Roto & Paint',
      security_tier: body.security_tier || 'MPAA Certified Tier 4',
      nda_signed: true,
      active_tasks_count: 0,
      active_projects: body.active_projects || ['NK99'],
      rating: 4.8,
      location: body.location || 'Vancouver, BC',
      status: 'Approved Partner',
      logo_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150&auto=format&fit=crop&q=80',
      bandwidth_gbps: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryVendors = [newVendor, ...inMemoryVendors];
    return { status: 201, data: newVendor as unknown as T };
  }

  // PEOPLE
  if (pathname === '/api/v1/people/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryPeople, fullUrl, ['full_name', 'email', 'role', 'department_name', 'skills', 'office_name']);
    const paginated = paginateDRF(filtered, fullUrl, 15);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.startsWith('/api/v1/people/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/people/', '').replace('/', '');
    const person = inMemoryPeople.find((p) => p.id === id);
    if (!person) throw ApiError.fromDrfResponse(404, { detail: 'Person not found' });
    return { status: 200, data: person as unknown as T };
  }

  if (pathname === '/api/v1/people/' && normMethod === 'POST') {
    const newPerson: Person = {
      id: `usr-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      full_name: body.full_name || 'New Artist',
      email: body.email || 'artist@apex.vfx',
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
    return { status: 201, data: newPerson as unknown as T };
  }

  if (pathname.startsWith('/api/v1/people/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/people/', '').replace('/', '');
    const idx = inMemoryPeople.findIndex((p) => p.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Person not found' });
    inMemoryPeople[idx] = {
      ...inMemoryPeople[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryPeople[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/people/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/people/', '').replace('/', '');
    inMemoryPeople = inMemoryPeople.filter((p) => p.id !== id);
    return { status: 204, data: null as unknown as T };
  }

  // DEPARTMENTS
  if (pathname === '/api/v1/departments/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryDepartments as unknown as T };
  }

  if (pathname.startsWith('/api/v1/departments/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/departments/', '').replace('/', '');
    const dept = inMemoryDepartments.find((d) => d.id === id || d.code.toLowerCase() === id.toLowerCase());
    if (!dept) throw ApiError.fromDrfResponse(404, { detail: 'Department not found' });
    return { status: 200, data: dept as unknown as T };
  }

  if (pathname === '/api/v1/departments/' && normMethod === 'POST') {
    const newDept: DepartmentEntity = {
      id: `dept-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      name: body.name || 'New Department',
      code: body.code || 'ND',
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
    return { status: 201, data: newDept as unknown as T };
  }

  if (pathname.startsWith('/api/v1/departments/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/departments/', '').replace('/', '');
    const idx = inMemoryDepartments.findIndex((d) => d.id === id || d.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Department not found' });
    inMemoryDepartments[idx] = {
      ...inMemoryDepartments[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryDepartments[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/departments/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/departments/', '').replace('/', '');
    inMemoryDepartments = inMemoryDepartments.filter((d) => d.id !== id && d.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
  }

  // TEAMS
  if (pathname === '/api/v1/teams/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryTeams as unknown as T };
  }

  if (pathname.startsWith('/api/v1/teams/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/teams/', '').replace('/', '');
    const team = inMemoryTeams.find((t) => t.id === id || t.code.toLowerCase() === id.toLowerCase());
    if (!team) throw ApiError.fromDrfResponse(404, { detail: 'Team not found' });
    return { status: 200, data: team as unknown as T };
  }

  if (pathname === '/api/v1/teams/' && normMethod === 'POST') {
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      department_id: body.department_id || 'dept-05',
      department_name: body.department_name || 'FX & Simulation',
      name: body.name || 'New Team Squad',
      code: body.code || 'NTS',
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
    return { status: 201, data: newTeam as unknown as T };
  }

  if (pathname.startsWith('/api/v1/teams/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/teams/', '').replace('/', '');
    const idx = inMemoryTeams.findIndex((t) => t.id === id || t.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Team not found' });
    inMemoryTeams[idx] = {
      ...inMemoryTeams[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryTeams[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/teams/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/teams/', '').replace('/', '');
    inMemoryTeams = inMemoryTeams.filter((t) => t.id !== id && t.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
  }

  // OFFICES
  if (pathname === '/api/v1/offices/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryOffices as unknown as T };
  }

  if (pathname.startsWith('/api/v1/offices/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/offices/', '').replace('/', '');
    const office = inMemoryOffices.find((o) => o.id === id || o.code.toLowerCase() === id.toLowerCase());
    if (!office) throw ApiError.fromDrfResponse(404, { detail: 'Office not found' });
    return { status: 200, data: office as unknown as T };
  }

  if (pathname === '/api/v1/offices/' && normMethod === 'POST') {
    const newOffice: Office = {
      id: `off-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      name: body.name || 'New Facility Hub',
      code: body.code || 'NFH',
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
      resources: body.resources || ['4K HDR Grading Suite', '10Gbps Fiber Uplink', 'Audio Foley Stage'],
      assigned_projects: body.assigned_projects || ['NK99'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryOffices = [newOffice, ...inMemoryOffices];
    return { status: 201, data: newOffice as unknown as T };
  }

  if (pathname.startsWith('/api/v1/offices/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/offices/', '').replace('/', '');
    const idx = inMemoryOffices.findIndex((o) => o.id === id || o.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Office not found' });
    inMemoryOffices[idx] = {
      ...inMemoryOffices[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryOffices[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/offices/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/offices/', '').replace('/', '');
    inMemoryOffices = inMemoryOffices.filter((o) => o.id !== id && o.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
  }

  // VERSIONS
  if (pathname === '/api/v1/versions/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryVersions, fullUrl, ['entity_code', 'version_number', 'department', 'published_by_name', 'status']);
    const paginated = paginateDRF(filtered, fullUrl, 15);
    return { status: 200, data: paginated as unknown as T };
  }

  // BILLING
  if (pathname === '/api/v1/billing/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryBilling as unknown as T };
  }

  // REPORTS
  if (pathname === '/api/v1/reports/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryReports as unknown as T };
  }

  // NOTIFICATIONS
  if (pathname === '/api/v1/notifications/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryNotifications as unknown as T };
  }

  // ----------------------------------------------------
  // ANALYTICS & ORGANIZATION
  // ----------------------------------------------------
  if (pathname === '/api/v1/analytics/kpis/' && normMethod === 'GET') {
    return { status: 200, data: mockProductionKpis as unknown as T };
  }

  if (pathname === '/api/v1/analytics/departments/' && normMethod === 'GET') {
    return { status: 200, data: mockDepartmentProgress as unknown as T };
  }

  if (pathname === '/api/v1/organization/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryOrganizations[0] as unknown as T };
  }

  // ----------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------
  if (pathname === '/api/v1/settings/pipeline/' && normMethod === 'GET') {
    return { status: 200, data: inMemorySettings as unknown as T };
  }

  if (pathname === '/api/v1/settings/pipeline/' && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    inMemorySettings = {
      ...inMemorySettings,
      ...body,
    };
    return { status: 200, data: inMemorySettings as unknown as T };
  }

  return null;
}
