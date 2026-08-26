import { mockUsers } from './db/identity/users';
import { mockProjects, Project } from './db/production/projects';
import { mockShots, Shot } from './db/production/shots';
import { mockAssets, Asset } from './db/assets/assets';
import { mockTasks, Task } from './db/tasks/tasks';
import { mockTimelogs } from './db/tasks/timelogs';
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
import { mockVersions } from './db/versions/versions';
import { mockMediaAssets } from './db/production/media';
import { mockProductionAttachments } from './db/production/attachments';
import { mockPlaylists, Playlist } from './db/production/playlists';
import {
  mockWorkflows,
  mockAutomationRules,
  mockAutomationAuditLogs,
} from './db/production/workflow';
import {
  mockResources,
  mockCalendarEvents,
  mockStudioHolidays,
  mockResourceLeaves,
  mockOverbookingAlerts,
} from './db/production/scheduling';
import { applyFiltersAndSearch, delay, paginateDRF } from './utils/mockServerHelpers';
import { ApiError } from '@/api/errors/ApiError';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { Timelog } from '@/types/tasks';
import { ProductionVersion } from '@/types/versions';
import { MediaItem } from '@/types/media';
import { AttachmentItem } from '@/types/attachments';
import {
  Workflow,
  AutomationRule,
  AutomationAuditLog,
  WorkflowDryRunResult,
  WorkflowDryRunStep,
} from '@/types/workflow';
import {
  Resource,
  CalendarEvent,
  StudioHoliday,
  ResourceLeave,
  SchedulingOverbookingAlert,
  SchedulingCapacitySummary,
} from '@/types/scheduling';
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
let inMemoryTimelogs: Timelog[] = [...mockTimelogs];
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
let inMemoryVersions: ProductionVersion[] = [...mockVersions];
let inMemoryMedia: MediaItem[] = [...mockMediaAssets];
let inMemoryAttachments: AttachmentItem[] = [...mockProductionAttachments];
let inMemoryPlaylists: Playlist[] = [...mockPlaylists];
let inMemoryNotifications = [...mockStudioNotifications];
let inMemoryBilling = { ...mockStudioBilling };
let inMemoryReports = [...mockProductionReports];
let inMemoryWorkflows: Workflow[] = [...mockWorkflows];
let inMemoryAutomationRules: AutomationRule[] = [...mockAutomationRules];
let inMemoryAutomationAuditLogs: AutomationAuditLog[] = [...mockAutomationAuditLogs];

let inMemoryResources: Resource[] = [...mockResources];
let inMemoryCalendarEvents: CalendarEvent[] = [...mockCalendarEvents];
let inMemoryStudioHolidays: StudioHoliday[] = [...mockStudioHolidays];
let inMemoryResourceLeaves: ResourceLeave[] = [...mockResourceLeaves];
let inMemoryOverbookingAlerts: SchedulingOverbookingAlert[] = [...mockOverbookingAlerts];

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
      client_id: body.client_id || 'cl-001',
      client_name: body.client_name || 'Warner Nexus Studios',
      client_contact_id: body.client_contact_id,
      client_contact_name: body.client_contact_name,
      vendor_ids: body.vendor_ids || [],
      vendor_names: body.vendor_names || [],
      vendor_team_ids: body.vendor_team_ids || [],
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
      project_name: body.project_name || 'Neo Kyoto 2099',
      name: body.name || 'New Asset',
      code: body.code || `AST_${Math.floor(Math.random() * 9000 + 1000)}`,
      category: body.category || 'Prop',
      description: body.description || '',
      status: body.status || 'Not Started',
      version: 'v001',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
      file_format: body.file_format || 'OpenUSD (.usda / .usdc)',
      poly_count: body.poly_count || 500000,
      lod_levels: body.lod_levels || 3,
      assigned_artist_id: body.assigned_artist_id,
      assigned_artist_name: body.assigned_artist_name || 'Sarah Jenkins',
      assigned_artist_avatar: body.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      software: body.software || 'Maya',
      department_id: body.department_id || 'dept-02',
      department_name: body.department_name || '3D Modeling & Assets',
      team_id: body.team_id || 'team-02',
      team_name: body.team_name || 'Hero Asset Crew',
      tags: body.tags || ['OpenUSD', 'Model'],
      usd_prim_path: body.usd_prim_path || `/World/Assets/${(body.name || 'Asset').replace(/\s+/g, '_')}`,
      is_archived: false,
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

  if (pathname.startsWith('/api/v1/assets/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/assets/', '').replace('/', '');
    const idx = inMemoryAssets.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Asset not found' });
    }
    inMemoryAssets = inMemoryAssets.filter((a) => a.id !== id);
    return { status: 204, data: null as unknown as T };
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
      project_name: body.project_name || 'Project Neon Nights',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_010',
      entity_name: body.entity_name || 'Shot NK_010_010',
      department: body.department || 'FX & Simulation',
      status: body.status || ('Not Started' as any),
      priority: body.priority || 'Medium',
      assignee_id: body.assignee_id,
      assignee_name: body.assignee_name || 'Elena Rostova',
      assignee_avatar: body.assignee_avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      reviewer_id: 'usr-001',
      reviewer_name: 'Alex Chen',
      schedule: body.schedule || {
        start_date: '2026-08-20',
        due_date: body.due_date || '2026-09-01',
        estimated_hours: body.estimated_hours || 24,
        logged_hours: body.logged_hours || 0,
        progress_percent: 0,
      },
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

  if (pathname.startsWith('/api/v1/tasks/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/tasks/', '').replace('/', '');
    inMemoryTasks = inMemoryTasks.filter((t) => t.id !== id);
    return { status: 204, data: {} as unknown as T };
  }

  // ----------------------------------------------------
  // TIMELOGS
  // ----------------------------------------------------
  if (pathname === '/api/v1/timelogs/' && normMethod === 'GET') {
    const taskId = fullUrl.searchParams.get('task_id');
    const personId = fullUrl.searchParams.get('person_id');
    const projectId = fullUrl.searchParams.get('project_id');
    const status = fullUrl.searchParams.get('status');
    const billable = fullUrl.searchParams.get('billable');
    const startDate = fullUrl.searchParams.get('start_date');
    const endDate = fullUrl.searchParams.get('end_date');
    const search = fullUrl.searchParams.get('search')?.toLowerCase();

    let filtered = [...inMemoryTimelogs];

    if (taskId && taskId !== 'ALL') {
      filtered = filtered.filter((t) => t.task_id === taskId);
    }
    if (personId && personId !== 'ALL') {
      filtered = filtered.filter((t) => t.person_id === personId);
    }
    if (projectId && projectId !== 'ALL') {
      filtered = filtered.filter((t) => t.project_id === projectId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((t) => t.status.toLowerCase() === status.toLowerCase());
    }
    if (billable !== null && billable !== undefined && billable !== 'ALL') {
      const isBillable = billable === 'true';
      filtered = filtered.filter((t) => t.billable === isBillable);
    }
    if (startDate) {
      filtered = filtered.filter((t) => t.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((t) => t.date <= endDate);
    }
    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.task_title.toLowerCase().includes(search) ||
          t.task_code.toLowerCase().includes(search) ||
          t.person_name.toLowerCase().includes(search) ||
          t.project_code.toLowerCase().includes(search) ||
          (t.notes && t.notes.toLowerCase().includes(search))
      );
    }

    // Sort by date desc
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const paginated = paginateDRF(filtered, fullUrl);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.includes('/approve') && pathname.startsWith('/api/v1/timelogs/') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/timelogs\/([^/]+)\/approve/);
    const id = match ? match[1] : '';
    const idx = inMemoryTimelogs.findIndex((l) => l.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Timelog not found' });
    }
    inMemoryTimelogs[idx] = {
      ...inMemoryTimelogs[idx],
      status: 'Approved',
      approved_by_id: body?.approved_by_id || 'usr-001',
      approved_by_name: body?.approved_by_name || 'Alex Chen',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryTimelogs[idx] as unknown as T };
  }

  if (pathname.includes('/reject') && pathname.startsWith('/api/v1/timelogs/') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/timelogs\/([^/]+)\/reject/);
    const id = match ? match[1] : '';
    const idx = inMemoryTimelogs.findIndex((l) => l.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Timelog not found' });
    }
    inMemoryTimelogs[idx] = {
      ...inMemoryTimelogs[idx],
      status: 'Rejected',
      rejection_reason: body?.rejection_reason || 'Needs clarification on logged tasks.',
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryTimelogs[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/timelogs/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/timelogs/', '').replace('/', '');
    const log = inMemoryTimelogs.find((l) => l.id === id);
    if (!log) {
      throw ApiError.fromDrfResponse(404, { detail: 'Timelog not found' });
    }
    return { status: 200, data: log as unknown as T };
  }

  if (pathname === '/api/v1/timelogs/' && normMethod === 'POST') {
    const task = inMemoryTasks.find((t) => t.id === body?.task_id) || {
      code: body?.task_code || 'TSK-GEN-001',
      title: body?.task_title || 'General Production Task',
      project_id: body?.project_id || 'proj-001',
      project_code: body?.project_code || 'NK99',
      project_name: body?.project_name || 'Cyberpunk 2099: Neo-Kyoto',
      department: body?.department || 'FX & Simulation',
    };

    const newLog: Timelog = {
      id: `time-${Date.now()}`,
      task_id: body?.task_id || 'task-001',
      task_code: body?.task_code || task.code,
      task_title: body?.task_title || task.title,
      project_id: body?.project_id || task.project_id,
      project_code: body?.project_code || task.project_code,
      project_name: body?.project_name || (task as any).project_name || task.project_code,
      person_id: body?.person_id || 'usr-001',
      person_name: body?.person_name || 'Alex Chen',
      person_avatar: body?.person_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      person_role: body?.person_role || 'VFX Supervisor',
      department: body?.department || task.department,
      duration_hours: Number(body?.duration_hours) || 1.0,
      date: body?.date || new Date().toISOString().split('T')[0],
      billable: body?.billable !== undefined ? body.billable : true,
      notes: body?.notes || '',
      status: body?.status || 'Submitted',
      activity_category: body?.activity_category || 'Direct Work',
      hourly_rate_usd: body?.hourly_rate_usd || 110,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryTimelogs = [newLog, ...inMemoryTimelogs];
    return { status: 201, data: newLog as unknown as T };
  }

  if (pathname.startsWith('/api/v1/timelogs/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/timelogs/', '').replace('/', '');
    const idx = inMemoryTimelogs.findIndex((l) => l.id === id);
    if (idx === -1) {
      throw ApiError.fromDrfResponse(404, { detail: 'Timelog not found' });
    }
    inMemoryTimelogs[idx] = {
      ...inMemoryTimelogs[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryTimelogs[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/timelogs/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/timelogs/', '').replace('/', '');
    inMemoryTimelogs = inMemoryTimelogs.filter((l) => l.id !== id);
    return { status: 204, data: {} as unknown as T };
  }

  // ----------------------------------------------------
  // REVIEWS & SCREENING
  // ----------------------------------------------------
  if (pathname === '/api/v1/reviews/' && normMethod === 'GET') {
    let list = [...inMemoryReviews];
    const projectId = fullUrl.searchParams.get('project_id');
    const entityCode = fullUrl.searchParams.get('entity_code');
    const status = fullUrl.searchParams.get('status');
    const clientOnly = fullUrl.searchParams.get('client_only');
    if (projectId) {
      list = list.filter((r) => r.project_id === projectId || r.project_code.toLowerCase() === projectId.toLowerCase());
    }
    if (entityCode) {
      list = list.filter((r) => r.entity_code.toLowerCase() === entityCode.toLowerCase());
    }
    if (status && status !== 'All') {
      list = list.filter((r) => r.status.toLowerCase() === status.toLowerCase());
    }
    if (clientOnly === 'true') {
      list = list.filter((r) => !!r.client);
    }
    const filtered = applyFiltersAndSearch(list, fullUrl, ['title', 'code', 'entity_code', 'lead_reviewer_name', 'project_name']);
    const paginated = paginateDRF(filtered, fullUrl);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname === '/api/v1/reviews/' && normMethod === 'POST') {
    const newRev: ReviewSession = {
      id: `rev-${Date.now()}`,
      code: body.code || `REV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      title: body.title || 'New Review Session',
      description: body.description || '',
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      project_name: body.project_name || 'Neo Kyoto 2099',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_010',
      version_id: body.version_id || 'ver-001',
      version_number: body.version_number || 'v001',
      video_url: body.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
      status: body.status || 'Draft',
      lead_reviewer_id: body.lead_reviewer_id || 'usr-001',
      lead_reviewer_name: body.lead_reviewer_name || 'Alex Chen',
      lead_reviewer_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      resolution: body.resolution || '4096x2160',
      fps: body.fps || 24,
      total_frames: body.total_frames || 144,
      frame_range: body.frame_range || '1001 - 1144',
      color_space: body.color_space || 'ACEScg (AP1)',
      dcc_software: body.dcc_software || 'Nuke / Maya',
      department: body.department || 'Compositing',
      supervisor_verdict: 'Pending Review',
      supervisor_notes: '',
      client: body.client || {
        id: 'cli-001',
        code: 'WARNER-MEDIA',
        name: 'Warner Bros. Discovery',
        representative_name: 'Michael Sterling',
        contact_email: 'm.sterling@warner.com',
        access_level: 'Full Review',
      },
      vendor: body.vendor,
      versions: body.versions || [
        {
          id: `ver-${Date.now()}`,
          version_number: body.version_number || 'v001',
          video_url: body.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
          artist_name: 'Alex Chen',
          status: 'Draft',
          is_hero: true,
          resolution: body.resolution || '4096x2160',
          fps: body.fps || 24,
          total_frames: body.total_frames || 144,
          created_at: new Date().toISOString(),
        },
      ],
      reviewers: body.reviewers || [
        {
          id: `rp-${Date.now()}-1`,
          user_id: 'usr-001',
          name: 'Alex Chen',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
          email: 'supervisor@studiohub.vfx',
          role: 'VFX Supervisor',
          verdict: 'Pending',
          is_required: true,
        },
      ],
      comments: [],
      notes: [],
      activity: [
        {
          id: `act-${Date.now()}`,
          review_id: `rev-${Date.now()}`,
          type: 'create',
          actor: {
            id: 'usr-001',
            name: 'Alex Chen',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
            role: 'VFX Supervisor',
          },
          description: `Created review session for ${body.entity_code || 'NK_010_010'}.`,
          timestamp: new Date().toISOString(),
        },
      ],
      annotations: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryReviews = [newRev, ...inMemoryReviews];
    return { status: 201, data: newRev as unknown as T };
  }

  // REVIEW OPERATIONS (Submit, Start, Approve, Reject, Request Changes, Close, Verdict)
  if (pathname.includes('/submit') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/submit/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    inMemoryReviews[idx].status = 'Submitted';
    inMemoryReviews[idx].activity = [
      {
        id: `act-${Date.now()}`,
        review_id: id,
        type: 'submit',
        actor: { id: 'usr-001', name: 'Alex Chen', role: 'VFX Supervisor' },
        description: 'Submitted review session to screening queue.',
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryReviews[idx].activity || []),
    ];
    inMemoryReviews[idx].updated_at = new Date().toISOString();
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.includes('/start-review') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/start-review/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    inMemoryReviews[idx].status = 'In Review';
    inMemoryReviews[idx].activity = [
      {
        id: `act-${Date.now()}`,
        review_id: id,
        type: 'start_review',
        actor: { id: 'usr-001', name: 'Alex Chen', role: 'VFX Supervisor' },
        description: 'Started live review session.',
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryReviews[idx].activity || []),
    ];
    inMemoryReviews[idx].updated_at = new Date().toISOString();
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.includes('/approve') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/approve/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    inMemoryReviews[idx].status = 'Approved';
    inMemoryReviews[idx].supervisor_verdict = 'Approved';
    inMemoryReviews[idx].supervisor_notes = body.notes || inMemoryReviews[idx].supervisor_notes;
    inMemoryReviews[idx].activity = [
      {
        id: `act-${Date.now()}`,
        review_id: id,
        type: 'approve',
        actor: { id: 'usr-001', name: body.actor_name || 'Alex Chen', role: 'VFX Supervisor' },
        description: `Approved ${inMemoryReviews[idx].title}. ${body.notes ? `Note: "${body.notes}"` : ''}`,
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryReviews[idx].activity || []),
    ];
    inMemoryReviews[idx].updated_at = new Date().toISOString();
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.includes('/reject') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/reject/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    inMemoryReviews[idx].status = 'Rejected';
    inMemoryReviews[idx].supervisor_verdict = 'Retake';
    inMemoryReviews[idx].supervisor_notes = body.notes || inMemoryReviews[idx].supervisor_notes;
    inMemoryReviews[idx].activity = [
      {
        id: `act-${Date.now()}`,
        review_id: id,
        type: 'reject',
        actor: { id: 'usr-001', name: body.actor_name || 'Alex Chen', role: 'VFX Supervisor' },
        description: `Rejected ${inMemoryReviews[idx].title}. Retake requested.`,
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryReviews[idx].activity || []),
    ];
    inMemoryReviews[idx].updated_at = new Date().toISOString();
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.includes('/request-changes') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/request-changes/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    inMemoryReviews[idx].status = 'Changes Requested';
    inMemoryReviews[idx].supervisor_verdict = 'Changes Requested';
    inMemoryReviews[idx].supervisor_notes = body.notes || inMemoryReviews[idx].supervisor_notes;
    inMemoryReviews[idx].activity = [
      {
        id: `act-${Date.now()}`,
        review_id: id,
        type: 'request_changes',
        actor: { id: 'usr-001', name: body.actor_name || 'Alex Chen', role: 'VFX Supervisor' },
        description: `Changes requested on ${inMemoryReviews[idx].title}. ${body.notes ? `Feedback: "${body.notes}"` : ''}`,
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryReviews[idx].activity || []),
    ];
    inMemoryReviews[idx].updated_at = new Date().toISOString();
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.includes('/close') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/close/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    inMemoryReviews[idx].status = 'Closed';
    inMemoryReviews[idx].activity = [
      {
        id: `act-${Date.now()}`,
        review_id: id,
        type: 'close',
        actor: { id: 'usr-001', name: 'Alex Chen', role: 'VFX Supervisor' },
        description: `Review session closed.`,
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryReviews[idx].activity || []),
    ];
    inMemoryReviews[idx].updated_at = new Date().toISOString();
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.includes('/comments') && normMethod === 'POST' && !pathname.includes('/resolve') && !pathname.includes('/reopen') && !pathname.includes('/reply')) {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/comments/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    const newComment = {
      id: `com-${Date.now()}`,
      review_id: id,
      frame_number: body.frame_number || 1,
      timecode: body.timecode || '01:00:00:00',
      author: body.author || {
        id: 'usr-001',
        name: 'Alex Chen',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        role: 'VFX Supervisor',
      },
      text: body.text || '',
      is_resolved: false,
      is_client_visible: body.is_client_visible ?? true,
      tags: body.tags || [],
      created_at: new Date().toISOString(),
      replies: [],
    };
    if (!inMemoryReviews[idx].comments) inMemoryReviews[idx].comments = [];
    inMemoryReviews[idx].comments!.push(newComment);
    inMemoryReviews[idx].activity = [
      {
        id: `act-${Date.now()}`,
        review_id: id,
        type: 'comment',
        actor: newComment.author,
        description: `Added comment on Frame ${newComment.frame_number}: "${newComment.text.slice(0, 40)}${newComment.text.length > 40 ? '...' : ''}"`,
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryReviews[idx].activity || []),
    ];
    inMemoryReviews[idx].updated_at = new Date().toISOString();
    return { status: 201, data: newComment as unknown as T };
  }

  if (pathname.includes('/resolve') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/comments\/([^/]+)\/resolve/);
    const revId = match ? match[1] : '';
    const comId = match ? match[2] : '';
    const rIdx = inMemoryReviews.findIndex((r) => r.id === revId);
    if (rIdx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review not found' });
    const comments = inMemoryReviews[rIdx].comments || [];
    const cIdx = comments.findIndex((c) => c.id === comId);
    if (cIdx !== -1) {
      comments[cIdx].is_resolved = true;
      comments[cIdx].resolved_by = { id: 'usr-001', name: 'Alex Chen' };
      comments[cIdx].resolved_at = new Date().toISOString();
      inMemoryReviews[rIdx].activity = [
        {
          id: `act-${Date.now()}`,
          review_id: revId,
          type: 'resolve_comment',
          actor: { id: 'usr-001', name: 'Alex Chen', role: 'VFX Supervisor' },
          description: `Resolved comment on Frame ${comments[cIdx].frame_number}.`,
          timestamp: new Date().toISOString(),
        },
        ...(inMemoryReviews[rIdx].activity || []),
      ];
    }
    return { status: 200, data: inMemoryReviews[rIdx] as unknown as T };
  }

  if (pathname.includes('/reopen') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/comments\/([^/]+)\/reopen/);
    const revId = match ? match[1] : '';
    const comId = match ? match[2] : '';
    const rIdx = inMemoryReviews.findIndex((r) => r.id === revId);
    if (rIdx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review not found' });
    const comments = inMemoryReviews[rIdx].comments || [];
    const cIdx = comments.findIndex((c) => c.id === comId);
    if (cIdx !== -1) {
      comments[cIdx].is_resolved = false;
      comments[cIdx].resolved_by = undefined;
      comments[cIdx].resolved_at = undefined;
      inMemoryReviews[rIdx].activity = [
        {
          id: `act-${Date.now()}`,
          review_id: revId,
          type: 'reopen_comment',
          actor: { id: 'usr-001', name: 'Alex Chen', role: 'VFX Supervisor' },
          description: `Reopened comment on Frame ${comments[cIdx].frame_number}.`,
          timestamp: new Date().toISOString(),
        },
        ...(inMemoryReviews[rIdx].activity || []),
      ];
    }
    return { status: 200, data: inMemoryReviews[rIdx] as unknown as T };
  }

  if (pathname.includes('/notes') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/reviews\/([^/]+)\/notes/);
    const id = match ? match[1] : '';
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review not found' });
    const newNote = {
      id: `note-${Date.now()}`,
      review_id: id,
      category: body.category || 'Supervisor',
      author_name: body.author_name || 'Alex Chen',
      author_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      author_role: body.author_role || 'VFX Supervisor',
      content: body.content || '',
      is_pinned: body.is_pinned ?? false,
      created_at: new Date().toISOString(),
    };
    if (!inMemoryReviews[idx].notes) inMemoryReviews[idx].notes = [];
    inMemoryReviews[idx].notes!.push(newNote);
    inMemoryReviews[idx].activity = [
      {
        id: `act-${Date.now()}`,
        review_id: id,
        type: 'note_added',
        actor: { id: 'usr-001', name: newNote.author_name, role: newNote.author_role },
        description: `Added ${newNote.category} Note: "${newNote.content.slice(0, 40)}..."`,
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryReviews[idx].activity || []),
    ];
    return { status: 201, data: newNote as unknown as T };
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
    if (!inMemoryReviews[idx].annotations) inMemoryReviews[idx].annotations = [];
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
      status: body.verdict === 'Approved' ? 'Approved' : body.verdict === 'Retake' ? 'Retake' : body.verdict === 'Changes Requested' ? 'Changes Requested' : 'Pending Review',
      supervisor_verdict: body.verdict,
      supervisor_notes: body.notes || inMemoryReviews[idx].supervisor_notes,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/reviews/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/reviews/', '').replace('/', '');
    const idx = inMemoryReviews.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Review session not found' });
    inMemoryReviews[idx] = {
      ...inMemoryReviews[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryReviews[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/reviews/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/reviews/', '').replace('/', '');
    const review = inMemoryReviews.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase());
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

  if (pathname.startsWith('/api/v1/clients/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/clients/', '').replace('/', '');
    const client = inMemoryClients.find((c) => c.id === id || c.code.toLowerCase() === id.toLowerCase());
    if (!client) throw ApiError.fromDrfResponse(404, { detail: 'Client not found' });
    return { status: 200, data: client as unknown as T };
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
    return { status: 201, data: newClient as unknown as T };
  }

  if (pathname.startsWith('/api/v1/clients/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/clients/', '').replace('/', '');
    const idx = inMemoryClients.findIndex((c) => c.id === id || c.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Client not found' });
    inMemoryClients[idx] = {
      ...inMemoryClients[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryClients[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/clients/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/clients/', '').replace('/', '');
    inMemoryClients = inMemoryClients.filter((c) => c.id !== id && c.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
  }

  // VENDORS
  if (pathname === '/api/v1/vendors/' && normMethod === 'GET') {
    const filtered = applyFiltersAndSearch(inMemoryVendors, fullUrl, ['name', 'code', 'contact_name', 'specialization', 'location']);
    const paginated = paginateDRF(filtered, fullUrl, 15);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.startsWith('/api/v1/vendors/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/vendors/', '').replace('/', '');
    const vendor = inMemoryVendors.find((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase());
    if (!vendor) throw ApiError.fromDrfResponse(404, { detail: 'Vendor not found' });
    return { status: 200, data: vendor as unknown as T };
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
      logo_url: body.logo_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150&auto=format&fit=crop&q=80',
      bandwidth_gbps: body.bandwidth_gbps || 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryVendors = [newVendor, ...inMemoryVendors];
    return { status: 201, data: newVendor as unknown as T };
  }

  if (pathname.startsWith('/api/v1/vendors/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/vendors/', '').replace('/', '');
    const idx = inMemoryVendors.findIndex((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Vendor not found' });
    inMemoryVendors[idx] = {
      ...inMemoryVendors[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryVendors[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/vendors/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/vendors/', '').replace('/', '');
    inMemoryVendors = inMemoryVendors.filter((v) => v.id !== id && v.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
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
    let list = [...inMemoryVersions];
    const projectId = fullUrl.searchParams.get('project_id');
    const entityType = fullUrl.searchParams.get('entity_type');
    const entityId = fullUrl.searchParams.get('entity_id');
    const department = fullUrl.searchParams.get('department');
    const status = fullUrl.searchParams.get('status');
    const isPublished = fullUrl.searchParams.get('is_published');
    const search = fullUrl.searchParams.get('search');

    if (projectId) {
      list = list.filter((v) => v.project_id === projectId || v.project_code.toLowerCase() === projectId.toLowerCase());
    }
    if (entityType) {
      list = list.filter((v) => v.entity_type.toLowerCase() === entityType.toLowerCase());
    }
    if (entityId) {
      list = list.filter((v) => v.entity_id === entityId || v.entity_code.toLowerCase() === entityId.toLowerCase());
    }
    if (department && department !== 'ALL') {
      list = list.filter((v) => v.department.toLowerCase() === department.toLowerCase());
    }
    if (status && status !== 'ALL') {
      list = list.filter((v) => v.status.toLowerCase() === status.toLowerCase());
    }
    if (isPublished !== null && isPublished !== undefined && isPublished !== '') {
      list = list.filter((v) => v.is_published === (isPublished === 'true'));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.code.toLowerCase().includes(q) ||
          v.entity_code.toLowerCase().includes(q) ||
          v.version_number.toLowerCase().includes(q) ||
          v.artist_name.toLowerCase().includes(q) ||
          v.department.toLowerCase().includes(q) ||
          v.notes?.toLowerCase().includes(q)
      );
    }

    const filtered = applyFiltersAndSearch(list, fullUrl, ['entity_code', 'version_number', 'department', 'artist_name', 'status']);
    const paginated = paginateDRF(filtered, fullUrl, 20);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.startsWith('/api/v1/versions/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/versions/', '').replace('/', '');
    const version = inMemoryVersions.find((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase());
    if (!version) throw ApiError.fromDrfResponse(404, { detail: 'Version not found' });
    
    // Enrich with media items and attachments if not populated
    const enrichedVersion: ProductionVersion = {
      ...version,
      media_items: inMemoryMedia.filter((m) => m.entity_id === version.id || m.entity_id === version.entity_id),
      attachments: inMemoryAttachments.filter((a) => a.entity_id === version.id || a.entity_id === version.entity_id),
    };
    return { status: 200, data: enrichedVersion as unknown as T };
  }

  if (pathname === '/api/v1/versions/' && normMethod === 'POST') {
    const newVersion: ProductionVersion = {
      id: `ver-${Date.now()}`,
      code: body.code || `VER-${body.entity_code || 'NK_SHOT'}-${(body.version_number || 'v001').toUpperCase()}`,
      version_number: body.version_number || 'v001',
      version_index: parseInt((body.version_number || 'v001').replace(/\D/g, ''), 10) || 1,
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      project_name: body.project_name || 'Project Neon Nights 2099',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_0010',
      entity_name: body.entity_name || 'Shot Render',
      shot_id: body.shot_id,
      shot_code: body.shot_code,
      asset_id: body.asset_id,
      asset_code: body.asset_code,
      task_id: body.task_id,
      task_code: body.task_code,
      task_title: body.task_title,
      department: body.department || 'Compositing (Nuke)',
      artist_id: body.artist_id || 'usr-003',
      artist_name: body.artist_name || 'Elena Rostova',
      artist_avatar: body.artist_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      artist: {
        id: body.artist_id || 'usr-003',
        name: body.artist_name || 'Elena Rostova',
        avatar: body.artist_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        role: body.department || 'Compositing (Nuke)',
      },
      status: body.status || 'Pending Review',
      is_published: body.is_published ?? false,
      is_hero: body.is_hero ?? false,
      is_archived: false,
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      video_url: body.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      frame_range: body.frame_range || '1001-1086 (86 frames)',
      start_frame: body.start_frame || 1001,
      end_frame: body.end_frame || 1086,
      resolution: body.resolution || '4096x2160 (4K DCI)',
      fps: body.fps || 24,
      file_size_mb: body.file_size_mb || 450,
      color_space: body.color_space || 'ACEScg',
      file_path: body.file_path || `/shows/${body.project_code || 'NK99'}/publish/${body.version_number || 'v001'}`,
      notes: body.notes || '',
      changelog: body.changelog || '',
      tags: body.tags || ['New Version'],
      reviews: [],
      playlists: [],
      activity: [
        {
          id: `act-${Date.now()}`,
          action: 'CREATED',
          user_name: body.artist_name || 'Elena Rostova',
          timestamp: new Date().toISOString(),
          description: `Created new version ${body.version_number || 'v001'}.`,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryVersions = [newVersion, ...inMemoryVersions];
    return { status: 201, data: newVersion as unknown as T };
  }

  if (pathname.startsWith('/api/v1/versions/') && pathname.endsWith('/publish/') && normMethod === 'POST') {
    const id = pathname.replace('/api/v1/versions/', '').replace('/publish/', '');
    const idx = inMemoryVersions.findIndex((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Version not found' });
    inMemoryVersions[idx] = {
      ...inMemoryVersions[idx],
      is_published: true,
      publishing_info: {
        dcc_software: body.dcc_software || 'StudioHub DCC Bridge',
        dcc_version: '2026.1',
        usd_stage_path: `@studio/shows/${inMemoryVersions[idx].project_code}/publish/${inMemoryVersions[idx].version_number}.usd`,
        usd_layer_identifier: `SdfLayerRef(@${inMemoryVersions[idx].code}.exr@)`,
        pyblish_status: 'Passed',
        validation_errors: [],
        is_hero_promoted: inMemoryVersions[idx].is_hero,
        published_at: new Date().toISOString(),
        publisher_name: body.publisher_name || 'Elena Rostova',
        publisher_id: 'usr-003',
        comment: body.comment || 'Published via Version Workspace',
      },
      activity: [
        {
          id: `act-${Date.now()}`,
          action: 'PUBLISHED',
          user_name: body.publisher_name || 'Elena Rostova',
          timestamp: new Date().toISOString(),
          description: `Published version ${inMemoryVersions[idx].version_number} to USD Stage.`,
        },
        ...(inMemoryVersions[idx].activity || []),
      ],
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryVersions[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/versions/') && pathname.endsWith('/unpublish/') && normMethod === 'POST') {
    const id = pathname.replace('/api/v1/versions/', '').replace('/unpublish/', '');
    const idx = inMemoryVersions.findIndex((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Version not found' });
    inMemoryVersions[idx] = {
      ...inMemoryVersions[idx],
      is_published: false,
      activity: [
        {
          id: `act-${Date.now()}`,
          action: 'UNPUBLISHED',
          user_name: body.user_name || 'Alex Chen',
          timestamp: new Date().toISOString(),
          description: `Unpublished version ${inMemoryVersions[idx].version_number} from production pipeline.`,
        },
        ...(inMemoryVersions[idx].activity || []),
      ],
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryVersions[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/versions/') && pathname.endsWith('/archive/') && normMethod === 'POST') {
    const id = pathname.replace('/api/v1/versions/', '').replace('/archive/', '');
    const idx = inMemoryVersions.findIndex((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Version not found' });
    inMemoryVersions[idx] = {
      ...inMemoryVersions[idx],
      is_archived: !inMemoryVersions[idx].is_archived,
      activity: [
        {
          id: `act-${Date.now()}`,
          action: 'ARCHIVED',
          user_name: 'Studio TD',
          timestamp: new Date().toISOString(),
          description: inMemoryVersions[idx].is_archived ? `Restored version ${inMemoryVersions[idx].version_number}.` : `Archived version ${inMemoryVersions[idx].version_number}.`,
        },
        ...(inMemoryVersions[idx].activity || []),
      ],
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryVersions[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/versions/') && pathname.endsWith('/add-to-playlist/') && normMethod === 'POST') {
    const id = pathname.replace('/api/v1/versions/', '').replace('/add-to-playlist/', '');
    const idx = inMemoryVersions.findIndex((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Version not found' });
    const version = inMemoryVersions[idx];
    const playlistId = body.playlist_id;
    const playlistName = body.playlist_name || 'Dailies Screening Reel';
    
    // Add to playlist store if exists
    const plIdx = inMemoryPlaylists.findIndex((p) => p.id === playlistId || p.code === playlistId);
    if (plIdx !== -1) {
      inMemoryPlaylists[plIdx].entries.push({
        id: `ple-${Date.now()}`,
        item_order: inMemoryPlaylists[plIdx].entries.length + 1,
        entity_type: 'Version',
        entity_code: version.code,
        version_number: version.version_number,
        thumbnail_url: version.thumbnail_url,
        duration_frames: version.end_frame ? (version.end_frame - (version.start_frame || 1001) + 1) : 48,
        frame_range: version.frame_range,
        fps: version.fps || 24,
        artist_name: version.artist_name,
        department: version.department,
        status: version.status,
        notes_count: 0,
      });
      inMemoryPlaylists[plIdx].items_count = inMemoryPlaylists[plIdx].entries.length;
    }

    // Record in version's playlist refs
    const existingRef = (version.playlists || []).find((p) => p.id === playlistId);
    if (!existingRef) {
      inMemoryVersions[idx].playlists = [
        ...(version.playlists || []),
        {
          id: playlistId || `ply-${Date.now()}`,
          code: `PLY-${playlistName.slice(0, 8).toUpperCase().replace(/\s+/g, '-')}`,
          name: playlistName,
          type: body.playlist_type || 'Dailies Reel',
          item_order: (version.playlists || []).length + 1,
          status: 'In Session',
          is_locked: false,
          created_at: new Date().toISOString(),
        },
      ];
    }
    return { status: 200, data: inMemoryVersions[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/versions/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/versions/', '').replace('/', '');
    const idx = inMemoryVersions.findIndex((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Version not found' });
    inMemoryVersions[idx] = {
      ...inMemoryVersions[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryVersions[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/versions/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/versions/', '').replace('/', '');
    inMemoryVersions = inMemoryVersions.filter((v) => v.id !== id && v.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
  }

  // MEDIA ENDPOINTS
  if (pathname === '/api/v1/media/' && normMethod === 'GET') {
    let list = [...inMemoryMedia];
    const entityType = fullUrl.searchParams.get('entity_type');
    const entityId = fullUrl.searchParams.get('entity_id');
    const mediaType = fullUrl.searchParams.get('media_type');
    const projectId = fullUrl.searchParams.get('project_id');
    const search = fullUrl.searchParams.get('search');

    if (entityType) {
      list = list.filter((m) => m.entity_type.toLowerCase() === entityType.toLowerCase());
    }
    if (entityId) {
      list = list.filter((m) => m.entity_id === entityId || m.entity_code.toLowerCase() === entityId.toLowerCase());
    }
    if (mediaType && mediaType !== 'ALL') {
      list = list.filter((m) => m.media_type.toLowerCase() === mediaType.toLowerCase());
    }
    if (projectId) {
      list = list.filter((m) => m.project_id === projectId || m.project_code.toLowerCase() === projectId.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || m.file_format.toLowerCase().includes(q));
    }

    return { status: 200, data: list as unknown as T };
  }

  if (pathname.startsWith('/api/v1/media/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/media/', '').replace('/', '');
    const media = inMemoryMedia.find((m) => m.id === id || m.code.toLowerCase() === id.toLowerCase());
    if (!media) throw ApiError.fromDrfResponse(404, { detail: 'Media item not found' });
    return { status: 200, data: media as unknown as T };
  }

  if (pathname === '/api/v1/media/' && normMethod === 'POST') {
    const newMedia: MediaItem = {
      id: `med-${Date.now()}`,
      code: body.code || `MED-${Date.now()}`,
      name: body.name || 'Uploaded Media Asset',
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      entity_type: body.entity_type || 'Version',
      entity_id: body.entity_id || 'ver-001',
      entity_code: body.entity_code || 'VER-NK010-0010-v004',
      media_type: body.media_type || 'image',
      category: body.category || 'Hero Render',
      file_format: body.file_format || 'OpenEXR Multi-Layer',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      source_url: body.source_url || body.preview_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600',
      preview_url: body.preview_url || body.source_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600',
      file_size_mb: body.file_size_mb || 45,
      resolution: body.resolution || '3840x2160',
      aspect_ratio: body.aspect_ratio || '16:9',
      fps: body.fps || 24,
      frame_count: body.frame_count || 1,
      duration_seconds: body.duration_seconds || 0,
      color_space: body.color_space || 'ACEScg',
      audio_channels: body.audio_channels || 'None',
      bit_depth: body.bit_depth || '16-bit Half Float',
      storage_tier: 'Tier 1 NVMe Hot',
      file_path: body.file_path || `/shows/storage/media/${Date.now()}`,
      tags: body.tags || ['Upload'],
      uploaded_by: body.uploaded_by || 'Elena Rostova',
      uploaded_at: new Date().toISOString(),
      description: body.description || '',
      is_primary: body.is_primary ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryMedia = [newMedia, ...inMemoryMedia];
    return { status: 201, data: newMedia as unknown as T };
  }

  if (pathname.startsWith('/api/v1/media/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/media/', '').replace('/', '');
    const idx = inMemoryMedia.findIndex((m) => m.id === id || m.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Media item not found' });
    inMemoryMedia[idx] = {
      ...inMemoryMedia[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryMedia[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/media/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/media/', '').replace('/', '');
    inMemoryMedia = inMemoryMedia.filter((m) => m.id !== id && m.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
  }

  // ATTACHMENT ENDPOINTS
  if (pathname === '/api/v1/attachments/' && normMethod === 'GET') {
    let list = [...inMemoryAttachments];
    const entityType = fullUrl.searchParams.get('entity_type');
    const entityId = fullUrl.searchParams.get('entity_id');
    const category = fullUrl.searchParams.get('category');
    const search = fullUrl.searchParams.get('search');

    if (entityType) {
      list = list.filter((a) => a.entity_type.toLowerCase() === entityType.toLowerCase());
    }
    if (entityId) {
      list = list.filter((a) => a.entity_id === entityId || a.entity_code.toLowerCase() === entityId.toLowerCase());
    }
    if (category && category !== 'ALL') {
      list = list.filter((a) => a.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.file_name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    return { status: 200, data: list as unknown as T };
  }

  if (pathname.startsWith('/api/v1/attachments/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/attachments/', '').replace('/', '');
    const att = inMemoryAttachments.find((a) => a.id === id || a.code.toLowerCase() === id.toLowerCase());
    if (!att) throw ApiError.fromDrfResponse(404, { detail: 'Attachment not found' });
    return { status: 200, data: att as unknown as T };
  }

  if (pathname === '/api/v1/attachments/' && normMethod === 'POST') {
    const newAtt: AttachmentItem = {
      id: `att-${Date.now()}`,
      code: body.code || `DOC-${Date.now()}`,
      file_name: body.file_name || 'document_upload.pdf',
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      entity_type: body.entity_type || 'project',
      entity_id: body.entity_id || 'proj-001',
      entity_code: body.entity_code || 'NK99',
      category: body.category || 'General Attachment',
      file_type: body.file_type || 'PDF Document',
      file_size_kb: body.file_size_kb || 1200,
      security_classification: body.security_classification || 'Internal Studio Only',
      version: body.version || 'v1.0',
      download_url: body.download_url || '#download',
      preview_url: body.preview_url,
      raw_content: body.raw_content,
      uploaded_by: body.uploaded_by || 'Alex Chen',
      uploaded_by_avatar: body.uploaded_by_avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      uploaded_at: new Date().toISOString(),
      description: body.description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryAttachments = [newAtt, ...inMemoryAttachments];
    return { status: 201, data: newAtt as unknown as T };
  }

  if (pathname.startsWith('/api/v1/attachments/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/attachments/', '').replace('/', '');
    inMemoryAttachments = inMemoryAttachments.filter((a) => a.id !== id && a.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
  }

  // PLAYLIST ENDPOINTS
  if (pathname === '/api/v1/playlists/' && normMethod === 'GET') {
    let list = [...inMemoryPlaylists];
    const projectId = fullUrl.searchParams.get('project_id');
    const search = fullUrl.searchParams.get('search');
    const clientOnly = fullUrl.searchParams.get('client_only');
    const status = fullUrl.searchParams.get('status');

    if (projectId) {
      list = list.filter((p) => p.project_id === projectId || p.project_code.toLowerCase() === projectId.toLowerCase());
    }
    if (clientOnly === 'true') {
      list = list.filter((p) => !!p.client);
    }
    if (status && status !== 'All') {
      list = list.filter((p) => p.status.toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return { status: 200, data: list as unknown as T };
  }

  if (pathname.includes('/add-entry') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/playlists\/([^/]+)\/add-entry/);
    const id = match ? match[1] : '';
    const idx = inMemoryPlaylists.findIndex((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Playlist not found' });
    const pl = inMemoryPlaylists[idx];
    const newEntry = {
      id: `ple-${Date.now()}`,
      item_order: (pl.entries || []).length + 1,
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_010',
      version_id: body.version_id || 'ver-001',
      version_number: body.version_number || 'v001',
      video_url: body.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400',
      duration_frames: body.duration_frames || 120,
      frame_range: body.frame_range || '1001 - 1120',
      fps: body.fps || 24,
      artist_name: body.artist_name || 'Alex Chen',
      department: body.department || 'Compositing',
      status: body.status || 'Pending Review',
      approval_status: body.approval_status || 'Pending Review',
      notes_count: 0,
      review_id: body.review_id,
    };
    pl.entries = [...(pl.entries || []), newEntry];
    pl.items_count = pl.entries.length;
    pl.total_duration_frames = pl.entries.reduce((acc, curr) => acc + curr.duration_frames, 0);
    const totalSec = Math.floor(pl.total_duration_frames / 24);
    const framesRemainder = pl.total_duration_frames % 24;
    pl.total_duration_timecode = `00:00:${totalSec.toString().padStart(2, '0')}:${framesRemainder.toString().padStart(2, '0')}`;
    pl.activity = [
      {
        id: `pact-${Date.now()}`,
        type: 'add_item',
        actor_name: 'Alex Chen',
        description: `Added ${newEntry.entity_code} (${newEntry.version_number}) to playlist.`,
        timestamp: new Date().toISOString(),
      },
      ...(pl.activity || []),
    ];
    pl.updated_at = new Date().toISOString();
    return { status: 200, data: pl as unknown as T };
  }

  if (pathname.includes('/remove-entry') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/playlists\/([^/]+)\/remove-entry/);
    const id = match ? match[1] : '';
    const idx = inMemoryPlaylists.findIndex((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Playlist not found' });
    const pl = inMemoryPlaylists[idx];
    const entryId = body.entry_id;
    const removedEntry = pl.entries.find((e) => e.id === entryId);
    pl.entries = pl.entries.filter((e) => e.id !== entryId).map((e, index) => ({ ...e, item_order: index + 1 }));
    pl.items_count = pl.entries.length;
    pl.total_duration_frames = pl.entries.reduce((acc, curr) => acc + curr.duration_frames, 0);
    const totalSec = Math.floor(pl.total_duration_frames / 24);
    const framesRemainder = pl.total_duration_frames % 24;
    pl.total_duration_timecode = `00:00:${totalSec.toString().padStart(2, '0')}:${framesRemainder.toString().padStart(2, '0')}`;
    if (removedEntry) {
      pl.activity = [
        {
          id: `pact-${Date.now()}`,
          type: 'remove_item',
          actor_name: 'Alex Chen',
          description: `Removed ${removedEntry.entity_code} (${removedEntry.version_number}) from playlist.`,
          timestamp: new Date().toISOString(),
        },
        ...(pl.activity || []),
      ];
    }
    pl.updated_at = new Date().toISOString();
    return { status: 200, data: pl as unknown as T };
  }

  if (pathname.includes('/reorder') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/playlists\/([^/]+)\/reorder/);
    const id = match ? match[1] : '';
    const idx = inMemoryPlaylists.findIndex((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Playlist not found' });
    const pl = inMemoryPlaylists[idx];
    const entries = body.entries || [];
    pl.entries = entries.map((e: any, index: number) => ({ ...e, item_order: index + 1 }));
    pl.activity = [
      {
        id: `pact-${Date.now()}`,
        type: 'reorder',
        actor_name: 'Alex Chen',
        description: 'Reordered playlist items for sequence playback.',
        timestamp: new Date().toISOString(),
      },
      ...(pl.activity || []),
    ];
    pl.updated_at = new Date().toISOString();
    return { status: 200, data: pl as unknown as T };
  }

  if (pathname.includes('/share') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/playlists\/([^/]+)\/share/);
    const id = match ? match[1] : '';
    const idx = inMemoryPlaylists.findIndex((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Playlist not found' });
    const pl = inMemoryPlaylists[idx];
    pl.share_settings = {
      is_public: body.is_public ?? true,
      allow_client_approval: body.allow_client_approval ?? true,
      require_passcode: body.require_passcode ?? false,
      passcode: body.passcode,
      share_token: body.share_token || `tok_share_${Date.now()}`,
      client_id: body.client_id,
      expires_at: body.expires_at || new Date(Date.now() + 14 * 86400000).toISOString(),
    };
    pl.activity = [
      {
        id: `pact-${Date.now()}`,
        type: 'share',
        actor_name: 'Alex Chen',
        description: `Generated secure share link for playlist.`,
        timestamp: new Date().toISOString(),
      },
      ...(pl.activity || []),
    ];
    pl.updated_at = new Date().toISOString();
    return { status: 200, data: pl as unknown as T };
  }

  if (pathname.includes('/archive') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/playlists\/([^/]+)\/archive/);
    const id = match ? match[1] : '';
    const idx = inMemoryPlaylists.findIndex((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Playlist not found' });
    inMemoryPlaylists[idx].status = 'Archived';
    inMemoryPlaylists[idx].is_archived = true;
    inMemoryPlaylists[idx].activity = [
      {
        id: `pact-${Date.now()}`,
        type: 'archive',
        actor_name: 'Alex Chen',
        description: 'Archived playlist reel.',
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryPlaylists[idx].activity || []),
    ];
    inMemoryPlaylists[idx].updated_at = new Date().toISOString();
    return { status: 200, data: inMemoryPlaylists[idx] as unknown as T };
  }

  if (pathname.includes('/restore') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/playlists\/([^/]+)\/restore/);
    const id = match ? match[1] : '';
    const idx = inMemoryPlaylists.findIndex((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Playlist not found' });
    inMemoryPlaylists[idx].status = 'Ready for Review';
    inMemoryPlaylists[idx].is_archived = false;
    inMemoryPlaylists[idx].activity = [
      {
        id: `pact-${Date.now()}`,
        type: 'restore',
        actor_name: 'Alex Chen',
        description: 'Restored playlist from archive.',
        timestamp: new Date().toISOString(),
      },
      ...(inMemoryPlaylists[idx].activity || []),
    ];
    inMemoryPlaylists[idx].updated_at = new Date().toISOString();
    return { status: 200, data: inMemoryPlaylists[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/playlists/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/playlists/', '').replace('/', '');
    const idx = inMemoryPlaylists.findIndex((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Playlist not found' });
    inMemoryPlaylists[idx] = {
      ...inMemoryPlaylists[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryPlaylists[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/playlists/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/playlists/', '').replace('/', '');
    inMemoryPlaylists = inMemoryPlaylists.filter((p) => p.id !== id && p.code.toLowerCase() !== id.toLowerCase());
    return { status: 204, data: null as unknown as T };
  }

  if (pathname.startsWith('/api/v1/playlists/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/playlists/', '').replace('/', '');
    const playlist = inMemoryPlaylists.find((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase());
    if (!playlist) throw ApiError.fromDrfResponse(404, { detail: 'Playlist not found' });
    return { status: 200, data: playlist as unknown as T };
  }

  if (pathname === '/api/v1/playlists/' && normMethod === 'POST') {
    const newPlaylist: Playlist = {
      id: `ply-${Date.now()}`,
      code: body.code || `PLY-NK-${Date.now().toString().slice(-4)}`,
      name: body.name || 'New Screening Reel',
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      project_name: body.project_name || 'Neo Kyoto 2099',
      type: body.type || 'Dailies Reel',
      description: body.description || '',
      author_name: body.author_name || 'Alex Chen',
      author_id: 'usr-001',
      author_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      items_count: (body.entries || []).length,
      total_duration_frames: (body.entries || []).reduce((acc: number, curr: any) => acc + (curr.duration_frames || 120), 0) || 120,
      total_duration_timecode: '00:00:05:00',
      status: body.status || 'Ready for Review',
      is_locked: false,
      is_archived: false,
      client: body.client,
      entries: body.entries || [],
      activity: [
        {
          id: `pact-${Date.now()}`,
          type: 'create',
          actor_name: 'Alex Chen',
          description: `Created playlist ${body.name || 'New Screening Reel'}.`,
          timestamp: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryPlaylists = [newPlaylist, ...inMemoryPlaylists];
    return { status: 201, data: newPlaylist as unknown as T };
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

  // ----------------------------------------------------
  // WORKFLOWS & AUTOMATIONS
  // ----------------------------------------------------
  if (pathname === '/api/v1/workflows/' && normMethod === 'GET') {
    const projectId = fullUrl.searchParams.get('project_id');
    const projectCode = fullUrl.searchParams.get('project_code');
    const category = fullUrl.searchParams.get('category');
    const isActive = fullUrl.searchParams.get('is_active');
    const department = fullUrl.searchParams.get('department');
    const search = fullUrl.searchParams.get('search')?.toLowerCase();

    let filtered = [...inMemoryWorkflows];

    if (projectId && projectId !== 'ALL') {
      filtered = filtered.filter((w) => w.project_id === projectId);
    }
    if (projectCode && projectCode !== 'ALL') {
      filtered = filtered.filter((w) => w.project_code.toLowerCase() === projectCode.toLowerCase());
    }
    if (category && category !== 'ALL') {
      filtered = filtered.filter((w) => w.category === category);
    }
    if (department && department !== 'ALL') {
      filtered = filtered.filter((w) => w.department.toLowerCase().includes(department.toLowerCase()) || w.department === 'Studio-Wide');
    }
    if (isActive !== null && isActive !== undefined && isActive !== 'ALL') {
      const activeBool = isActive === 'true';
      filtered = filtered.filter((w) => w.is_active === activeBool);
    }
    if (search) {
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(search) ||
          w.code.toLowerCase().includes(search) ||
          w.description.toLowerCase().includes(search) ||
          w.project_name.toLowerCase().includes(search)
      );
    }

    const paginated = paginateDRF(filtered, fullUrl);
    return { status: 200, data: paginated as unknown as T };
  }

  if (pathname.endsWith('/simulate/') && pathname.startsWith('/api/v1/workflows/') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/workflows\/([^/]+)\/simulate/);
    const id = match ? match[1] : '';
    const wf = inMemoryWorkflows.find((w) => w.id === id);
    if (!wf) throw ApiError.fromDrfResponse(404, { detail: 'Workflow not found' });

    const entityType = body?.entity_type || 'Shot';
    const entityCode = body?.entity_code || 'SH_010';
    const triggerEvent = body?.trigger_event || 'version.approved';

    // Simulate dry run steps across nodes
    const dryRunSteps: WorkflowDryRunStep[] = wf.nodes.map((node, index) => {
      let status: 'executed' | 'skipped' | 'failed' = 'executed';
      let message = `Node [${node.title}] evaluated successfully.`;

      if (node.type === 'condition') {
        message = `Condition check [${node.config.condition_field || 'status'} ${node.config.condition_operator || '=='} "${node.config.condition_value || 'Approved'}"] evaluated to TRUE.`;
      } else if (node.type === 'publish') {
        message = `Pyblish validation pass 100%. Master artifact [${node.config.output_artifact || 'USD/EXR'}] registered.`;
      } else if (node.type === 'approval') {
        message = `Gatekeeper signoff simulated by Supervisor Alex Chen.`;
      } else if (node.type === 'delivery') {
        message = `Aspera transfer package queued for client turnover.`;
      } else if (node.type === 'automation') {
        message = `Triggered side-effect cascade: [${node.config.automation_action || 'notify_producer'}].`;
      }

      return {
        node_id: node.id,
        node_title: node.title,
        node_type: node.type,
        status,
        duration_ms: Math.floor(Math.random() * 80) + 20,
        log_message: message,
        emitted_actions: node.config.auto_trigger_rules || [
          `Auto-advance downstream dependencies for ${node.title}`,
        ],
      };
    });

    const auditEntry: AutomationAuditLog = {
      id: `autolog-sim-${Date.now()}`,
      rule_id: wf.automation_rules?.[0]?.id || 'rule-sim',
      rule_name: `${wf.name} Dry-Run Simulation`,
      workflow_id: wf.id,
      workflow_name: wf.name,
      trigger_event: triggerEvent,
      entity_type: entityType,
      entity_id: `ent-${Date.now()}`,
      entity_code: entityCode,
      actor_id: 'usr-001',
      actor_name: 'Alex Chen',
      actor_role: 'VFX Supervisor',
      executed_at: new Date().toISOString(),
      duration_ms: dryRunSteps.reduce((acc, s) => acc + s.duration_ms, 0),
      status: 'success',
      step_logs: dryRunSteps.map((s, idx) => ({
        step: `${idx + 1}. ${s.node_title}`,
        action_type: s.node_type,
        status: s.status === 'executed' ? 'success' : s.status,
        message: s.log_message,
        duration_ms: s.duration_ms,
      })),
    };

    inMemoryAutomationAuditLogs = [auditEntry, ...inMemoryAutomationAuditLogs];

    const result: WorkflowDryRunResult = {
      workflow_id: wf.id,
      simulation_id: `sim-${Date.now()}`,
      entity_type: entityType,
      entity_code: entityCode,
      trigger_event: triggerEvent,
      executed_at: new Date().toISOString(),
      overall_status: 'success',
      total_duration_ms: auditEntry.duration_ms,
      steps: dryRunSteps,
      side_effects: [
        'Version marked Published',
        'Production Coordinator alerted via Slack',
        'Aspera Turnover Package manifest generated',
      ],
      audit_entry: auditEntry,
    };

    return { status: 200, data: result as unknown as T };
  }

  if (pathname.endsWith('/clone/') && pathname.startsWith('/api/v1/workflows/') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/workflows\/([^/]+)\/clone/);
    const id = match ? match[1] : '';
    const existing = inMemoryWorkflows.find((w) => w.id === id);
    if (!existing) throw ApiError.fromDrfResponse(404, { detail: 'Workflow not found' });

    const newCode = `${existing.code}-CLONE`;
    const cloned: Workflow = {
      ...existing,
      id: `wf-${Date.now()}`,
      code: newCode,
      name: `${existing.name} (Copy)`,
      version: `${parseFloat(existing.version || '1.0') + 0.1}.0`,
      is_active: false,
      is_default: false,
      created_by_name: 'Alex Chen',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryWorkflows = [cloned, ...inMemoryWorkflows];
    return { status: 201, data: cloned as unknown as T };
  }

  if (pathname.endsWith('/activate/') && pathname.startsWith('/api/v1/workflows/') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/workflows\/([^/]+)\/activate/);
    const id = match ? match[1] : '';
    const idx = inMemoryWorkflows.findIndex((w) => w.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Workflow not found' });
    inMemoryWorkflows[idx] = {
      ...inMemoryWorkflows[idx],
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryWorkflows[idx] as unknown as T };
  }

  if (pathname.endsWith('/deactivate/') && pathname.startsWith('/api/v1/workflows/') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/workflows\/([^/]+)\/deactivate/);
    const id = match ? match[1] : '';
    const idx = inMemoryWorkflows.findIndex((w) => w.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Workflow not found' });
    inMemoryWorkflows[idx] = {
      ...inMemoryWorkflows[idx],
      is_active: false,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryWorkflows[idx] as unknown as T };
  }

  if (pathname.endsWith('/archive/') && pathname.startsWith('/api/v1/workflows/') && normMethod === 'POST') {
    const match = pathname.match(/\/api\/v1\/workflows\/([^/]+)\/archive/);
    const id = match ? match[1] : '';
    const idx = inMemoryWorkflows.findIndex((w) => w.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Workflow not found' });
    inMemoryWorkflows[idx] = {
      ...inMemoryWorkflows[idx],
      is_active: false,
      is_archived: true,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryWorkflows[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/workflows/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/workflows/', '').replace('/', '');
    const wf = inMemoryWorkflows.find((w) => w.id === id || w.code.toLowerCase() === id.toLowerCase());
    if (!wf) throw ApiError.fromDrfResponse(404, { detail: 'Workflow not found' });
    return { status: 200, data: wf as unknown as T };
  }

  if (pathname === '/api/v1/workflows/' && normMethod === 'POST') {
    const newWorkflow: Workflow = {
      id: `wf-${Date.now()}`,
      code: body?.code || `WF-STUDIO-${Date.now().toString().slice(-4)}`,
      name: body?.name || 'New Production DAG Workflow',
      project_id: body?.project_id || 'proj-001',
      project_code: body?.project_code || 'NK99',
      project_name: body?.project_name || 'Cyberpunk 2099: Neo-Kyoto',
      department: body?.department || 'Studio-Wide',
      category: body?.category || 'Shot Pipeline',
      description: body?.description || 'Custom production workflow graph.',
      version: body?.version || '1.0.0',
      is_active: body?.is_active ?? true,
      is_default: body?.is_default ?? false,
      nodes: body?.nodes || [
        {
          id: 'start-1',
          type: 'start',
          title: 'Start',
          config: {},
          position: { x: 50, y: 200 },
        },
        {
          id: 'task-1',
          type: 'task',
          title: 'Production Task',
          config: {},
          position: { x: 350, y: 200 },
        },
        {
          id: 'end-1',
          type: 'end',
          title: 'End',
          config: {},
          position: { x: 650, y: 200 },
        },
      ],
      transitions: body?.transitions || [
        { id: 't-1', source_node_id: 'start-1', target_node_id: 'task-1' },
        { id: 't-2', source_node_id: 'task-1', target_node_id: 'end-1' },
      ],
      automation_rules: body?.automation_rules || [],
      created_by_name: 'Alex Chen',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      execution_stats: {
        total_runs: 0,
        success_rate: 100,
        avg_duration_hours: 0,
        active_tasks_count: 0,
        last_run_status: 'idle',
      },
    };

    inMemoryWorkflows = [newWorkflow, ...inMemoryWorkflows];
    return { status: 201, data: newWorkflow as unknown as T };
  }

  if (pathname.startsWith('/api/v1/workflows/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/workflows/', '').replace('/', '');
    const idx = inMemoryWorkflows.findIndex((w) => w.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Workflow not found' });

    inMemoryWorkflows[idx] = {
      ...inMemoryWorkflows[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryWorkflows[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/workflows/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/workflows/', '').replace('/', '');
    inMemoryWorkflows = inMemoryWorkflows.filter((w) => w.id !== id);
    return { status: 204, data: {} as unknown as T };
  }

  // AUTOMATION RULES
  if (pathname === '/api/v1/automations/rules/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryAutomationRules as unknown as T };
  }

  if (pathname === '/api/v1/automations/rules/' && normMethod === 'POST') {
    const newRule: AutomationRule = {
      id: `rule-${Date.now()}`,
      workflow_id: body?.workflow_id || 'wf-001',
      name: body?.name || 'New Automation Rule',
      description: body?.description || '',
      trigger: body?.trigger || { event: 'version.approved', entity_type: 'Version' },
      conditions: body?.conditions || [],
      actions: body?.actions || [],
      is_active: body?.is_active ?? true,
      required_role: body?.required_role || 'Supervisor',
      execution_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryAutomationRules = [newRule, ...inMemoryAutomationRules];
    return { status: 201, data: newRule as unknown as T };
  }

  if (pathname.startsWith('/api/v1/automations/rules/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/automations/rules/', '').replace('/', '');
    const idx = inMemoryAutomationRules.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Automation rule not found' });
    inMemoryAutomationRules[idx] = {
      ...inMemoryAutomationRules[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryAutomationRules[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/automations/rules/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/automations/rules/', '').replace('/', '');
    inMemoryAutomationRules = inMemoryAutomationRules.filter((r) => r.id !== id);
    return { status: 204, data: {} as unknown as T };
  }

  // AUTOMATION AUDIT LOGS
  if (pathname === '/api/v1/automations/audit-logs/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryAutomationAuditLogs as unknown as T };
  }

  // ==========================================
  // SCHEDULING, CALENDAR & RESOURCES API
  // ==========================================

  // CALENDAR EVENTS
  if (pathname === '/api/v1/scheduling/events/' && normMethod === 'GET') {
    let list = [...inMemoryCalendarEvents];
    if (params?.project_id) {
      list = list.filter((e) => e.project_id === params.project_id);
    }
    if (params?.project_code) {
      list = list.filter((e) => e.project_code?.toLowerCase() === String(params.project_code).toLowerCase());
    }
    if (params?.event_type) {
      const types = String(params.event_type).split(',');
      list = list.filter((e) => types.includes(e.event_type));
    }
    if (params?.department) {
      list = list.filter((e) => e.department?.toLowerCase() === String(params.department).toLowerCase());
    }
    if (params?.office_id) {
      list = list.filter((e) => e.office_id === params.office_id || e.office_id === 'off-all');
    }
    if (params?.assignee_id) {
      list = list.filter((e) => e.assignee_ids.includes(params.assignee_id) || e.primary_assignee_id === params.assignee_id);
    }
    if (params?.search) {
      const q = String(params.search).toLowerCase();
      list = list.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.project_code?.toLowerCase().includes(q)
      );
    }
    return { status: 200, data: list as unknown as T };
  }

  if (pathname === '/api/v1/scheduling/events/' && normMethod === 'POST') {
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: body?.title || 'Untitled Studio Event',
      event_type: body?.event_type || 'task',
      start_date: body?.start_date || new Date().toISOString(),
      end_date: body?.end_date || new Date().toISOString(),
      all_day: body?.all_day ?? true,
      status: body?.status || 'Scheduled',
      priority: body?.priority || 'Medium',
      project_id: body?.project_id,
      project_code: body?.project_code,
      project_name: body?.project_name,
      task_id: body?.task_id,
      task_code: body?.task_code,
      review_id: body?.review_id,
      delivery_id: body?.delivery_id,
      milestone_id: body?.milestone_id,
      department: body?.department,
      department_id: body?.department_id,
      team_id: body?.team_id,
      team_name: body?.team_name,
      office_id: body?.office_id || 'off-mtl-01',
      office_name: body?.office_name || 'Montreal HQ',
      primary_assignee_id: body?.primary_assignee_id,
      primary_assignee_name: body?.primary_assignee_name,
      primary_assignee_avatar: body?.primary_assignee_avatar,
      assignee_ids: body?.assignee_ids || (body?.primary_assignee_id ? [body.primary_assignee_id] : []),
      assignee_names: body?.assignee_names || (body?.primary_assignee_name ? [body.primary_assignee_name] : []),
      equipment_ids: body?.equipment_ids || [],
      equipment_names: body?.equipment_names || [],
      location_or_link: body?.location_or_link,
      description: body?.description || '',
      color: body?.color,
      progress_pct: body?.progress_pct ?? 0,
      dependencies: body?.dependencies,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryCalendarEvents = [newEvent, ...inMemoryCalendarEvents];
    return { status: 201, data: newEvent as unknown as T };
  }

  if (pathname.startsWith('/api/v1/scheduling/events/') && normMethod === 'GET') {
    const id = pathname.replace('/api/v1/scheduling/events/', '').replace('/', '');
    const evt = inMemoryCalendarEvents.find((e) => e.id === id);
    if (!evt) throw ApiError.fromDrfResponse(404, { detail: 'Calendar event not found' });
    return { status: 200, data: evt as unknown as T };
  }

  if (pathname.startsWith('/api/v1/scheduling/events/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/scheduling/events/', '').replace('/', '');
    const idx = inMemoryCalendarEvents.findIndex((e) => e.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Calendar event not found' });
    inMemoryCalendarEvents[idx] = {
      ...inMemoryCalendarEvents[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryCalendarEvents[idx] as unknown as T };
  }

  if (pathname.startsWith('/api/v1/scheduling/events/') && normMethod === 'DELETE') {
    const id = pathname.replace('/api/v1/scheduling/events/', '').replace('/', '');
    inMemoryCalendarEvents = inMemoryCalendarEvents.filter((e) => e.id !== id);
    return { status: 204, data: {} as unknown as T };
  }

  // RESOURCES
  if (pathname === '/api/v1/scheduling/resources/' && normMethod === 'GET') {
    let list = [...inMemoryResources];
    if (params?.type) {
      list = list.filter((r) => r.type === params.type);
    }
    if (params?.department_id) {
      list = list.filter((r) => r.department_id === params.department_id);
    }
    if (params?.office_id) {
      list = list.filter((r) => r.office_id === params.office_id);
    }
    if (params?.status) {
      list = list.filter((r) => r.availability_status === params.status);
    }
    if (params?.is_overbooked === 'true' || params?.is_overbooked === true) {
      list = list.filter((r) => r.is_overbooked);
    }
    if (params?.search) {
      const q = String(params.search).toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.role?.toLowerCase().includes(q) ||
          r.department_name?.toLowerCase().includes(q)
      );
    }
    return { status: 200, data: list as unknown as T };
  }

  if (pathname.startsWith('/api/v1/scheduling/resources/') && (normMethod === 'PATCH' || normMethod === 'PUT')) {
    const id = pathname.replace('/api/v1/scheduling/resources/', '').replace('/', '');
    const idx = inMemoryResources.findIndex((r) => r.id === id);
    if (idx === -1) throw ApiError.fromDrfResponse(404, { detail: 'Resource not found' });
    inMemoryResources[idx] = {
      ...inMemoryResources[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return { status: 200, data: inMemoryResources[idx] as unknown as T };
  }

  // CAPACITY SUMMARY
  if (pathname === '/api/v1/scheduling/capacity/' && normMethod === 'GET') {
    const deptMap: Record<string, SchedulingCapacitySummary> = {};
    inMemoryResources.forEach((res) => {
      const dept = res.department_name || 'General';
      if (!deptMap[dept]) {
        deptMap[dept] = {
          department: dept,
          total_resources: 0,
          total_capacity_hours: 0,
          allocated_hours: 0,
          free_hours: 0,
          utilization_pct: 0,
          overbooked_count: 0,
        };
      }
      deptMap[dept].total_resources += 1;
      deptMap[dept].total_capacity_hours += res.capacity_weekly_hours;
      deptMap[dept].allocated_hours += res.assigned_hours_current_week;
      if (res.is_overbooked) {
        deptMap[dept].overbooked_count += 1;
      }
    });

    const summaries = Object.values(deptMap).map((s) => ({
      ...s,
      free_hours: Math.max(0, s.total_capacity_hours - s.allocated_hours),
      utilization_pct: s.total_capacity_hours > 0 ? Math.round((s.allocated_hours / s.total_capacity_hours) * 100) : 0,
    }));
    return { status: 200, data: summaries as unknown as T };
  }

  // OVERBOOKING CONFLICTS
  if (pathname === '/api/v1/scheduling/overbooking/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryOverbookingAlerts as unknown as T };
  }

  if (pathname === '/api/v1/scheduling/resolve-overbooking/' && normMethod === 'POST') {
    const alertId = body?.alert_id;
    inMemoryOverbookingAlerts = inMemoryOverbookingAlerts.filter((a) => a.id !== alertId);
    if (body?.resource_id) {
      const rIdx = inMemoryResources.findIndex((r) => r.id === body.resource_id);
      if (rIdx !== -1) {
        inMemoryResources[rIdx].is_overbooked = false;
        inMemoryResources[rIdx].overbooking_reason = undefined;
        inMemoryResources[rIdx].utilization_pct = Math.min(100, inMemoryResources[rIdx].utilization_pct);
        inMemoryResources[rIdx].availability_status = 'Assigned';
      }
    }
    return { status: 200, data: { success: true, message: 'Conflict resolved successfully' } as unknown as T };
  }

  // HOLIDAYS & LEAVES
  if (pathname === '/api/v1/scheduling/holidays/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryStudioHolidays as unknown as T };
  }

  if (pathname === '/api/v1/scheduling/leaves/' && normMethod === 'GET') {
    return { status: 200, data: inMemoryResourceLeaves as unknown as T };
  }

  if (pathname === '/api/v1/scheduling/leaves/' && normMethod === 'POST') {
    const newLeave: ResourceLeave = {
      id: `leave-${Date.now()}`,
      resource_id: body?.resource_id || 'usr-001',
      resource_name: body?.resource_name || 'Alex Chen',
      leave_type: body?.leave_type || 'Annual Leave',
      start_date: body?.start_date || new Date().toISOString().split('T')[0],
      end_date: body?.end_date || new Date().toISOString().split('T')[0],
      total_days: body?.total_days || 1,
      status: body?.status || 'Approved',
      notes: body?.notes,
    };
    inMemoryResourceLeaves = [newLeave, ...inMemoryResourceLeaves];
    return { status: 201, data: newLeave as unknown as T };
  }

  return null;
}
