import { UniversalEntityType, UniversalEntityDetail, EntityReference } from '@/types/workspace';
import {
  mockOrganizations,
  mockClients,
  mockVendors,
  mockPeople,
  mockDepartments,
  mockTeams,
  mockOffices,
  mockPublishedVersions,
} from '@/mocks/db/organization/organization';
import { mockShots } from '@/mocks/db/production/shots';
import { mockAssets } from '@/mocks/db/assets/assets';
import { mockTasks } from '@/mocks/db/tasks/tasks';
import { mockReviews } from '@/mocks/db/reviews/reviews';
import { mockPublishRecords } from '@/mocks/db/production/publishing';
import { mockPlaylists } from '@/mocks/db/production/playlists';
import { mockWorkflows } from '@/mocks/db/production/workflow';
import { mockTimelogs } from '@/mocks/db/production/timelogs';
import { mockCalendarMilestones } from '@/mocks/db/production/calendar';
import { mockMediaAssets } from '@/mocks/db/production/media';
import { mockProductionAttachments } from '@/mocks/db/production/attachments';
import { queryClient } from '@/providers/QueryProvider';
import { PROJECT_QUERY_KEYS } from '@/modules/production/hooks/useProjects';
import { Project } from '@/mocks/db/production/projects';
import { PaginatedResponse } from '@/types/drf';

/**
 * Reads real projects from the React Query cache (populated by useProjects /
 * useActiveProject). Returns [] until the list has been fetched.
 */
function getRealProjects(): Project[] {
  const cached = queryClient.getQueryData<PaginatedResponse<Project>>(
    PROJECT_QUERY_KEYS.list(localStorage.getItem('studiohub_active_org_id') || undefined, { page_size: 100 })
  );
  if (cached?.results?.length) return cached.results;
  for (const q of queryClient.getQueryCache().getAll()) {
    const key = q.queryKey;
    if (Array.isArray(key) && key[0] === 'projects' && key[1] === 'list') {
      const data = q.state.data as PaginatedResponse<Project> | undefined;
      if (data?.results?.length) return data.results;
    }
  }
  return [];
}

function findRealProject(id: string): Project | null {
  const normalized = id.toLowerCase();
  return getRealProjects().find((p) => p.id === id || p.code.toLowerCase() === normalized) || null;
}

// Mock Sequences
export const mockSequences = [
  {
    id: 'seq-010',
    code: 'NK_010',
    name: 'Neon Canyon Spinner Chase',
    project_id: 'proj-001',
    project_code: 'NK99',
    description: 'High speed aerial pursuit across Neo-Kyoto neon skyline with holographic billboards.',
    status: 'In Progress',
    shots_count: 24,
    approved_shots: 12,
  },
  {
    id: 'seq-020',
    code: 'NK_020',
    name: 'Underground Slums Infiltration',
    project_id: 'proj-001',
    project_code: 'NK99',
    description: 'Tactical team enters subterranean maintenance tunnels under heavy rainfall.',
    status: 'In Progress',
    shots_count: 18,
    approved_shots: 8,
  },
  {
    id: 'seq-100',
    code: 'AETH_100',
    name: 'Citadel Dragon Siege',
    project_id: 'proj-002',
    project_code: 'AETH2',
    description: 'Ancient Wyrm assaults the floating citadel battlements with volumetric dragon breath.',
    status: 'Pending Review',
    shots_count: 36,
    approved_shots: 22,
  },
];

// Mock Notes
export const mockNotes = [
  {
    id: 'not-001',
    code: 'DIR-8812',
    title: 'Director Note: Lighting contrast on spinner windshield',
    author: 'Alex Chen',
    role: 'VFX Supervisor',
    text: 'Boost the specular highlights by 1.2 stops when entering the holographic projection zone.',
    timestamp: '2 hours ago',
    project_code: 'NK99',
  },
  {
    id: 'not-002',
    code: 'DIR-8813',
    title: 'Client Feedback: Pyroclastic drag forces',
    author: 'Marcus Vance',
    role: 'Client Producer',
    text: 'Client wants more high-density trailing embers behind the plasma missile impact.',
    timestamp: '5 hours ago',
    project_code: 'NK99',
  },
];

// Mock Deliveries
export const mockDeliveries = [
  {
    id: 'del-001',
    code: 'DEL-2026-0818-FINAL',
    title: 'Trailer 02 Final 4K DCI EXR Delivery',
    project_id: 'proj-001',
    project_code: 'NK99',
    status: 'Approved',
    target: 'Warner Nexus Studios (Aspera Drop)',
    package_size: '1.42 TB (4,200 EXR frames)',
    due_date: '2026-08-28',
  },
  {
    id: 'del-002',
    code: 'DEL-2026-0820-TEMP',
    title: 'Episodic Temp Sound & VFX QuickTime Pull',
    project_id: 'proj-002',
    project_code: 'AETH2',
    status: 'In Progress',
    target: 'Editorial Avid Sync Hub',
    package_size: '48.6 GB (ProRes 4444 XQ)',
    due_date: '2026-08-22',
  },
];

// Mock Schedules
export const mockSchedules = [
  {
    id: 'sch-001',
    code: 'MILE-Q3-01',
    title: 'Q3 Principal Shot Turnover Milestone',
    project_id: 'proj-001',
    project_code: 'NK99',
    status: 'In Progress',
    start_date: '2026-07-01',
    end_date: '2026-09-15',
    progress: 74,
  },
  {
    id: 'sch-002',
    code: 'MILE-Q3-02',
    title: 'Creature FX & Fur Groom Lock',
    project_id: 'proj-002',
    project_code: 'AETH2',
    status: 'In Progress',
    start_date: '2026-06-15',
    end_date: '2026-08-30',
    progress: 88,
  },
];

// Mock Resources
export const mockResources = [
  {
    id: 'res-001',
    code: 'FARM-BLADE-POOL-A',
    title: 'Montreal High-Density Karma/Houdini Render Cluster',
    type: 'Compute Resource',
    status: 'Active',
    capacity: '128 Dual-EPYC Blades (16,384 Cores)',
    utilization: '87.4%',
    allocated_to: 'NK99 / AETH2',
  },
  {
    id: 'res-002',
    code: 'SAN-NVME-FLASH-01',
    title: 'Global NVMe High-IOPS Tier 1 Storage Pool',
    type: 'Storage Resource',
    status: 'Active',
    capacity: '500 TB (342.5 TB Allocated)',
    utilization: '68.5%',
    allocated_to: 'All Active Productions',
  },
];

/**
 * Universal Entity Resolver
 * Seamlessly resolves any entity by type and ID into a rich UniversalEntityDetail
 * with its relational links for non-linear workspace exploration.
 */
export function resolveEntity(type: UniversalEntityType, id: string): UniversalEntityDetail | null {
  if (!id) return null;

  switch (type) {
    case 'organization': {
      const org = mockOrganizations.find((o) => o.id === id || o.code.toLowerCase() === id.toLowerCase()) || mockOrganizations[0];
      if (!org) return null;
      return {
        id: org.id,
        type: 'organization',
        code: org.code,
        title: org.name,
        subtitle: `${org.tier} • ${org.headquarters}`,
        description: `Headquartered in ${org.headquarters} overseeing ${org.offices_count} international facilities, ${org.active_projects_count} active productions, and ${org.crew_count} artists.`,
        status: org.status,
        thumbnail_url: org.logo_url,
        banner_url: org.banner_url,
        created_at: org.created_at,
        updated_at: org.updated_at,
        properties: {
          'Headquarters': org.headquarters,
          'Active Crew': `${org.crew_count} Artists`,
          'Storage Quota': `${org.storage_used_tb} / ${org.storage_quota_tb} TB`,
          'Default Color Space': org.settings.default_color_space,
          'Default FPS': `${org.settings.default_fps} FPS`,
          'OpenUSD Schema': org.settings.usd_schema_version,
          'Render Farm Region': org.settings.render_farm_region,
        },
        tags: ['VFX Studio Hub', org.tier, org.code],
        relations: {
          client: { id: 'cli-01', type: 'client', title: 'Warner Nexus Studios', code: 'WNEX', status: 'Active' },
          project: { id: 'proj-001', type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: 'NK99', status: 'In Progress' },
          people: mockPeople.slice(0, 6).map((p) => ({ id: p.id, type: 'person', title: p.full_name, subtitle: p.role, thumbnail_url: p.avatar_url })),
          teams: mockTeams.map((t) => ({ id: t.id, type: 'team', title: t.name, code: t.code })),
        },
      };
    }

    case 'client': {
      const client = mockClients.find((c) => c.id === id || c.code.toLowerCase() === id.toLowerCase()) || mockClients[0];
      if (!client) return null;
      return {
        id: client.id,
        type: 'client',
        code: client.code,
        title: client.name,
        subtitle: `${client.studio_type} • ${client.contract_tier}`,
        description: `Strategic studio client with ${client.active_projects.length} active productions and dedicated client review portal access.`,
        status: client.status,
        thumbnail_url: client.logo_url,
        created_at: client.created_at,
        properties: {
          'Studio Type': client.studio_type,
          'Headquarters': client.headquarters,
          'Primary Contact': `${client.contact_name} (${client.email})`,
          'Contract Tier': client.contract_tier,
          'Active Shows': client.active_projects.join(', '),
          'Portal Access': client.portal_access ? 'Enabled' : 'Restricted',
        },
        tags: [client.studio_type, client.contract_tier],
        relations: {
          parent: { id: 'org-apex-01', type: 'organization', title: 'Apex Digital Studios', code: 'APEX' },
          project: { id: 'proj-001', type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: 'NK99', status: 'In Progress' },
          reviewer: { id: 'usr-002', type: 'person', title: client.contact_name, subtitle: client.email },
          shots: mockShots.slice(0, 3).map((s) => ({ id: s.id, type: 'shot', title: s.name, code: s.code, status: s.status, thumbnail_url: s.thumbnail_url })),
          deliveries: mockDeliveries.map((d) => ({ id: d.id, type: 'delivery', title: d.title, code: d.code, status: d.status })),
        },
      };
    }

    case 'vendor': {
      const vendor = mockVendors.find((v) => v.id === id || v.code.toLowerCase() === id.toLowerCase()) || mockVendors[0];
      if (!vendor) return null;
      return {
        id: vendor.id,
        type: 'vendor',
        code: vendor.code,
        title: vendor.name,
        subtitle: `${vendor.specialization} • ${vendor.location}`,
        description: `External partner laboratory specializing in ${vendor.specialization}. Security accreditation: ${vendor.security_tier}.`,
        status: vendor.status,
        thumbnail_url: vendor.logo_url,
        created_at: vendor.created_at,
        properties: {
          'Specialization': vendor.specialization,
          'Facility Location': vendor.location,
          'Security Tier': vendor.security_tier,
          'Active Turnarounds': `${vendor.active_tasks_count} tasks in queue`,
          'Rating': `${vendor.rating} / 5.0`,
          'Lead Contact': `${vendor.contact_name} (${vendor.email})`,
          'Direct Dedicated Link': `${vendor.bandwidth_gbps} Gbps Encrypted Optical Link`,
        },
        tags: [vendor.specialization, vendor.security_tier],
        relations: {
          parent: { id: 'org-apex-01', type: 'organization', title: 'Apex Digital Studios', code: 'APEX' },
          project: { id: 'proj-001', type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: 'NK99', status: 'In Progress' },
          tasks: mockTasks.slice(0, 3).map((t) => ({ id: t.id, type: 'task', title: t.title, code: t.code, status: t.status })),
          shots: mockShots.slice(0, 2).map((s) => ({ id: s.id, type: 'shot', title: s.name, code: s.code, status: s.status, thumbnail_url: s.thumbnail_url })),
        },
      };
    }

    case 'person': {
      const person = mockPeople.find((p) => p.id === id || p.full_name.toLowerCase().includes(id.toLowerCase())) || mockPeople[0];
      if (!person) return null;
      return {
        id: person.id,
        type: 'person',
        code: person.full_name.split(' ').map((n) => n[0]).join(''),
        title: person.full_name,
        subtitle: `${person.role} • ${person.department_name}`,
        description: `${person.role} (${person.seniority}) based in ${person.office_name}. Primary DCC skills: ${person.skills.join(', ')}.`,
        status: person.availability_status,
        thumbnail_url: person.avatar_url,
        created_at: person.created_at,
        properties: {
          'Role': person.role,
          'Seniority': person.seniority,
          'Discipline / Dept': person.department_name,
          'Team Squad': person.team_name || 'Unassigned Squad',
          'Facility Hub': person.office_name,
          'Timezone': person.timezone,
          'Email': person.email,
          'Active Tasks': person.active_tasks,
          'Hours Logged': `${person.logged_hours} hrs`,
          'DCC Skills': person.skills.join(', '),
        },
        tags: [person.department_name, person.office_name, person.availability_status],
        relations: {
          parent: { id: 'org-apex-01', type: 'organization', title: 'Apex Digital Studios', code: 'APEX' },
          project: { id: 'proj-001', type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: 'NK99', status: 'In Progress' },
          department: { id: person.department_id, type: 'department', title: person.department_name, code: 'DEPT' },
          team: person.team_id ? { id: person.team_id, type: 'team', title: person.team_name || 'Squad', code: 'TEAM' } : undefined,
          tasks: mockTasks.filter((t) => t.assignee_name === person.full_name).map((t) => ({ id: t.id, type: 'task', title: t.title, code: t.code, status: t.status })),
          shots: mockShots.filter((s) => s.assigned_artist_name === person.full_name).map((s) => ({ id: s.id, type: 'shot', title: s.name, code: s.code, status: s.status, thumbnail_url: s.thumbnail_url })),
        },
      };
    }

    case 'department': {
      const dept = mockDepartments.find((d) => d.id === id || d.code.toLowerCase() === id.toLowerCase()) || mockDepartments[0];
      if (!dept) return null;
      return {
        id: dept.id,
        type: 'department',
        code: dept.code,
        title: dept.name,
        subtitle: `Discipline Lead: ${dept.head_name}`,
        description: dept.description,
        status: 'Active',
        properties: {
          'Department Head': dept.head_name,
          'Crew Size': `${dept.member_count} Artists & TDs`,
          'Active Task Queue': `${dept.active_tasks_count} Work Items`,
          'DCC Toolchain': dept.software_stack.join(', '),
        },
        tags: ['Pipeline Discipline', dept.code],
        relations: {
          parent: { id: 'org-apex-01', type: 'organization', title: 'Apex Digital Studios', code: 'APEX' },
          assignee: { id: dept.head_id, type: 'person', title: dept.head_name, subtitle: 'Discipline Head' },
          teams: mockTeams.filter((t) => t.department_id === dept.id).map((t) => ({ id: t.id, type: 'team', title: t.name, code: t.code })),
          tasks: mockTasks.slice(0, 3).map((t) => ({ id: t.id, type: 'task', title: t.title, code: t.code, status: t.status })),
        },
      };
    }

    case 'team': {
      const team = mockTeams.find((t) => t.id === id || t.code.toLowerCase() === id.toLowerCase()) || mockTeams[0];
      if (!team) return null;
      return {
        id: team.id,
        type: 'team',
        code: team.code,
        title: team.name,
        subtitle: `${team.department_name} • Show: ${team.current_project_code}`,
        description: `Dedicated squad assigned to ${team.current_project_code} (${team.focus_discipline}).`,
        status: 'Active',
        properties: {
          'Team Lead': team.lead_name,
          'Discipline': team.department_name,
          'Focus Area': team.focus_discipline,
          'Assigned Show': team.current_project_code,
          'Squad Members': `${team.member_count} Artists`,
        },
        tags: [team.department_name, team.current_project_code],
        relations: {
          parent: { id: 'org-apex-01', type: 'organization', title: 'Apex Digital Studios', code: 'APEX' },
          project: { id: team.current_project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: team.current_project_code, status: 'In Progress' },
          assignee: { id: team.lead_id, type: 'person', title: team.lead_name, subtitle: 'Squad Lead' },
          tasks: mockTasks.slice(0, 3).map((t) => ({ id: t.id, type: 'task', title: t.title, code: t.code, status: t.status })),
        },
      };
    }

    case 'office': {
      const office = mockOffices.find((o) => o.id === id || o.code.toLowerCase() === id.toLowerCase()) || mockOffices[0];
      if (!office) return null;
      return {
        id: office.id,
        type: 'office',
        code: office.code,
        title: office.name,
        subtitle: `${office.city}, ${office.country} • ${office.timezone}`,
        description: `${office.address}. Main facility hub supporting calibrated screening suites and studio farm edge nodes.`,
        status: office.status,
        properties: {
          'Facility Location': `${office.city}, ${office.country}`,
          'Local Timezone': office.timezone,
          'Resident Artists': `${office.current_occupancy} / ${office.capacity} Crew members`,
          'Facility Manager': office.manager_name,
          'Dedicated Bandwidth': `${office.network_speed_gbps} Gbps`,
          'Color Management': office.color_space,
        },
        tags: [office.country, office.status],
        relations: {
          parent: { id: 'org-apex-01', type: 'organization', title: 'Apex Digital Studios', code: 'APEX' },
          people: mockPeople.filter((p) => p.office_name.includes(office.city)).map((p) => ({ id: p.id, type: 'person', title: p.full_name, subtitle: p.role, thumbnail_url: p.avatar_url })),
        },
      };
    }

    case 'project': {
      const proj = findRealProject(id);
      if (!proj) return null;
      return {
        id: proj.id,
        type: 'project',
        code: proj.code,
        title: proj.name,
        subtitle: `${proj.type} • Client: ${proj.client_name}`,
        description: proj.description,
        status: proj.status,
        thumbnail_url: proj.thumbnail_url,
        created_at: proj.created_at,
        updated_at: proj.updated_at,
        properties: {
          'Production Type': proj.type,
          'Client Studio': proj.client_name,
          'VFX Supervisor': proj.supervisor_name,
          'VFX Producer': proj.coordinator_name,
          'Timeline / Delivery': proj.start_date && proj.delivery_date ? `${proj.start_date} → ${proj.delivery_date}` : 'TBD',
          'Resolution / FPS': `${proj.resolution} @ ${proj.fps} FPS`,
          'Aspect Ratio': proj.aspect_ratio,
          'Color Management': proj.color_space,
          'Total Shot Count': `${proj.total_shots} (${proj.approved_shots} Approved, ${proj.in_progress_shots} In Progress)`,
          'Asset Library': `${proj.total_assets} Hero Assets`,
          'Allocated Budget': `$${(Number(proj.budget_usd) / 1000000).toFixed(2)}M USD`,
        },
        tags: [proj.type, proj.color_space, proj.status],
        relations: {
          parent: { id: 'org-apex-01', type: 'organization', title: 'Apex Digital Studios', code: 'APEX' },
          client: { id: 'cli-01', type: 'client', title: proj.client_name, code: 'WNEX', status: 'Active' },
          vendor: { id: 'ven-01', type: 'vendor', title: 'PixelCraft FX Labs', code: 'PXCFX', status: 'Active' },
          assignee: { id: 'usr-001', type: 'person', title: proj.supervisor_name, subtitle: 'VFX Supervisor' },
          reviewer: { id: 'usr-002', type: 'person', title: proj.coordinator_name, subtitle: 'Production Coordinator' },
          shots: mockShots.filter((s) => s.project_code === proj.code).map((s) => ({ id: s.id, type: 'shot', title: s.name, code: s.code, status: s.status, thumbnail_url: s.thumbnail_url })),
          assets: mockAssets.filter((a) => a.project_code === proj.code).map((a) => ({ id: a.id, type: 'asset', title: a.name, code: a.code, status: a.status, thumbnail_url: a.thumbnail_url })),
          tasks: mockTasks.filter((t) => t.project_code === proj.code).map((t) => ({ id: t.id, type: 'task', title: t.title, code: t.code, status: t.status })),
          deliveries: mockDeliveries.filter((d) => d.project_code === proj.code).map((d) => ({ id: d.id, type: 'delivery', title: d.title, code: d.code, status: d.status })),
          notes: mockNotes.map((n) => ({ id: n.id, author: n.author, role: n.role, text: n.text, timestamp: n.timestamp })),
        },
      };
    }

    case 'sequence': {
      const seq = mockSequences.find((s) => s.id === id || s.code.toLowerCase() === id.toLowerCase()) || mockSequences[0];
      if (!seq) return null;
      return {
        id: seq.id,
        type: 'sequence',
        code: seq.code,
        title: seq.name,
        subtitle: `Project: ${seq.project_code} • ${seq.shots_count} Shots`,
        description: seq.description,
        status: seq.status,
        properties: {
          'Sequence Code': seq.code,
          'Parent Show': seq.project_code,
          'Total Cuts': `${seq.shots_count} Shots`,
          'Approved Cuts': `${seq.approved_shots} Shots`,
          'Completion': `${Math.round((seq.approved_shots / seq.shots_count) * 100)}%`,
        },
        tags: ['Sequence Unit', seq.project_code],
        relations: {
          project: { id: seq.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: seq.project_code, status: 'In Progress' },
          shots: mockShots.filter((s) => s.sequence_code === seq.code).map((s) => ({ id: s.id, type: 'shot', title: s.name, code: s.code, status: s.status, thumbnail_url: s.thumbnail_url })),
        },
      };
    }

    case 'shot': {
      const shot = mockShots.find((s) => s.id === id || s.code.toLowerCase() === id.toLowerCase()) || mockShots[0];
      if (!shot) return null;
      return {
        id: shot.id,
        type: 'shot',
        code: shot.code,
        title: shot.name,
        subtitle: `${shot.project_code} • Seq ${shot.sequence_code} • ${shot.current_version}`,
        description: shot.description,
        status: shot.status,
        thumbnail_url: shot.thumbnail_url,
        created_at: shot.created_at,
        updated_at: shot.updated_at,
        properties: {
          'Cut Frame Range': `${shot.frame_in} - ${shot.frame_out} (${shot.frame_count} frames)`,
          'Head/Tail Handles': `±${shot.handle_frames} frames`,
          'Current Version': shot.current_version,
          'Assigned Lead': shot.assigned_artist_name || 'Alex Chen',
          'Supervisor Final': shot.supervisor_approved ? 'Approved' : 'Pending Review',
          'Client Delivery Status': shot.client_approved ? 'Client Approved' : 'In Review',
          'OpenUSD Root Layer': `@studio/shows/${shot.project_code}/shots/${shot.code}/${shot.code}.usd`,
        },
        tags: [shot.sequence_code, shot.status, shot.current_version],
        relations: {
          project: { id: shot.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: shot.project_code, status: 'In Progress' },
          sequence: { id: 'seq-010', type: 'sequence', title: 'Neon Canyon Spinner Chase', code: shot.sequence_code, status: 'In Progress' },
          assignee: { id: shot.assigned_artist_id || 'usr-003', type: 'person', title: shot.assigned_artist_name || 'Elena Rostova', subtitle: 'Lead FX Artist' },
          reviewer: { id: 'usr-001', type: 'person', title: 'Alex Chen', subtitle: 'VFX Supervisor' },
          tasks: mockTasks.filter((t) => t.entity_code === shot.code || t.entity_id === shot.id).map((t) => ({ id: t.id, type: 'task', title: t.title, code: t.code, status: t.status })),
          versions: mockPublishedVersions.filter((v) => v.entity_code === shot.code).map((v) => ({ id: v.id, type: 'version', title: `${shot.code} ${v.version_number}`, code: v.version_number, status: v.status, thumbnail_url: v.thumbnail_url })),
          reviews: mockReviews.filter((r) => r.entity_code === shot.code).map((r) => ({ id: r.id, type: 'review', title: r.title, code: r.code, status: r.status, thumbnail_url: r.thumbnail_url })),
          notes: mockNotes.map((n) => ({ id: n.id, author: n.author, role: n.role, text: n.text, timestamp: n.timestamp })),
        },
      };
    }

    case 'asset': {
      const asset = mockAssets.find((a) => a.id === id || a.code.toLowerCase() === id.toLowerCase()) || mockAssets[0];
      if (!asset) return null;
      return {
        id: asset.id,
        type: 'asset',
        code: asset.code,
        title: asset.name,
        subtitle: `${asset.category} • ${asset.project_code} • ${asset.version}`,
        description: asset.description,
        status: asset.status,
        thumbnail_url: asset.thumbnail_url,
        created_at: asset.created_at,
        updated_at: asset.updated_at,
        properties: {
          'Asset Category': asset.category,
          'Polygon Count': `${(asset.poly_count / 1000000).toFixed(2)}M Polygons`,
          'LOD Cascades': `${asset.lod_levels} LOD Levels`,
          'Authoring DCC': asset.software,
          'Payload Format': asset.file_format,
          'Artist Lead': asset.assigned_artist_name || 'Sarah Jenkins',
          'Supervisor Signoff': asset.approved_by_name || 'Alex Chen',
        },
        tags: [asset.category, asset.software, asset.status],
        relations: {
          project: { id: asset.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: asset.project_code, status: 'In Progress' },
          assignee: { id: asset.assigned_artist_id || 'usr-004', type: 'person', title: asset.assigned_artist_name || 'Sarah Jenkins', subtitle: 'Senior Model/LookDev TD' },
          reviewer: { id: 'usr-001', type: 'person', title: 'Alex Chen', subtitle: 'VFX Supervisor' },
          tasks: mockTasks.filter((t) => t.entity_code === asset.code || t.entity_id === asset.id).map((t) => ({ id: t.id, type: 'task', title: t.title, code: t.code, status: t.status })),
          versions: mockPublishedVersions.filter((v) => v.entity_code === asset.code).map((v) => ({ id: v.id, type: 'version', title: `${asset.code} ${v.version_number}`, code: v.version_number, status: v.status, thumbnail_url: v.thumbnail_url })),
        },
      };
    }

    case 'task': {
      const task = mockTasks.find((t) => t.id === id || t.code.toLowerCase() === id.toLowerCase()) || mockTasks[0];
      if (!task) return null;
      return {
        id: task.id,
        type: 'task',
        code: task.code,
        title: task.title,
        subtitle: `${task.department} • ${task.entity_code} • Due: ${task.due_date}`,
        description: task.description,
        status: task.status,
        created_at: task.created_at,
        updated_at: task.updated_at,
        properties: {
          'Discipline': task.department,
          'Priority': task.priority,
          'Target Entity': `${task.entity_type} ${task.entity_code}`,
          'Assigned Artist': task.assignee_name || 'Unassigned',
          'Supervisor Reviewer': task.reviewer_name || 'Alex Chen',
          'Estimated Budget': `${task.estimated_hours} hrs`,
          'Logged Time': `${task.logged_hours} hrs (${Math.round((task.logged_hours / task.estimated_hours) * 100)}%)`,
          'Primary Software': task.software,
          'Target Due Date': task.due_date,
        },
        tags: [task.department, task.priority, task.status],
        relations: {
          project: { id: task.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: task.project_code, status: 'In Progress' },
          shot: task.entity_type === 'Shot' ? { id: task.entity_id, type: 'shot', title: task.entity_code, code: task.entity_code, status: task.status } : undefined,
          asset: task.entity_type === 'Asset' ? { id: task.entity_id, type: 'asset', title: task.entity_code, code: task.entity_code, status: task.status } : undefined,
          assignee: { id: task.assignee_id || 'usr-003', type: 'person', title: task.assignee_name || 'Elena Rostova', subtitle: `${task.department} Artist`, thumbnail_url: task.assignee_avatar },
          reviewer: { id: task.reviewer_id || 'usr-001', type: 'person', title: task.reviewer_name || 'Alex Chen', subtitle: 'VFX Supervisor' },
          notes: mockNotes.map((n) => ({ id: n.id, author: n.author, role: n.role, text: n.text, timestamp: n.timestamp })),
        },
      };
    }

    case 'version': {
      const ver = mockPublishedVersions.find((v) => v.id === id || v.version_number.toLowerCase() === id.toLowerCase()) || mockPublishedVersions[0];
      if (!ver) return null;
      return {
        id: ver.id,
        type: 'version',
        code: `${ver.entity_code}_${ver.version_number}`,
        title: `${ver.entity_code} ${ver.version_number} (${ver.entity_type})`,
        subtitle: `Show: ${ver.project_code} • ${ver.frame_range}`,
        description: `Published OpenUSD payload and EXR render pass. Path: ${ver.usd_stage_path}`,
        status: ver.status,
        thumbnail_url: ver.thumbnail_url,
        created_at: ver.created_at,
        properties: {
          'Version Tag': ver.version_number,
          'Parent Entity': `${ver.entity_type} [${ver.entity_code}]`,
          'Frame Range': ver.frame_range,
          'File Size': `${ver.file_size_mb} MB`,
          'Submitter': `${ver.published_by_name} (${ver.department})`,
          'OpenUSD Sublayer': ver.usd_stage_path,
        },
        tags: [ver.version_number, ver.department, ver.status],
        relations: {
          project: { id: 'proj-001', type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: ver.project_code, status: 'In Progress' },
          shot: ver.entity_type === 'Shot' ? { id: 'shot-001', type: 'shot', title: ver.entity_code, code: ver.entity_code, status: ver.status } : undefined,
          asset: ver.entity_type === 'Asset' ? { id: 'ast-001', type: 'asset', title: ver.entity_code, code: ver.entity_code, status: ver.status } : undefined,
          assignee: { id: 'usr-003', type: 'person', title: ver.published_by_name, subtitle: ver.department },
          reviews: mockReviews.filter((r) => r.entity_code === ver.entity_code).map((r) => ({ id: r.id, type: 'review', title: r.title, code: r.code, status: r.status, thumbnail_url: r.thumbnail_url })),
        },
      };
    }

    case 'review': {
      const rev = mockReviews.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase()) || mockReviews[0];
      if (!rev) return null;
      return {
        id: rev.id,
        type: 'review',
        code: rev.code,
        title: rev.title,
        subtitle: `${rev.project_code} • ${rev.entity_code} ${rev.version_number} • Lead: ${rev.lead_reviewer_name}`,
        description: rev.supervisor_notes || `Screening room session for ${rev.entity_code} ${rev.version_number}. Total Annotations: ${rev.annotations.length}.`,
        status: rev.status,
        thumbnail_url: rev.thumbnail_url,
        created_at: rev.created_at,
        properties: {
          'Review Code': rev.code,
          'Target Cut': `${rev.entity_code} ${rev.version_number}`,
          'Lead Reviewer': rev.lead_reviewer_name,
          'Supervisor Verdict': rev.supervisor_verdict || 'Pending Review',
          'Playback Spec': `${rev.resolution} @ ${rev.fps} FPS (${rev.total_frames} frames)`,
          'Annotation Count': `${rev.annotations.length} Frame Annotations`,
          'Directives': rev.supervisor_notes || 'No critical notes',
        },
        tags: [rev.version_number, rev.status],
        relations: {
          project: { id: rev.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: rev.project_code, status: 'In Progress' },
          shot: { id: rev.entity_id || 'shot-001', type: 'shot', title: rev.entity_code, code: rev.entity_code, status: rev.status },
          reviewer: { id: rev.lead_reviewer_id || 'usr-001', type: 'person', title: rev.lead_reviewer_name, subtitle: 'Lead Reviewer' },
          versions: mockPublishedVersions.filter((v) => v.entity_code === rev.entity_code).map((v) => ({ id: v.id, type: 'version', title: `${rev.entity_code} ${v.version_number}`, code: v.version_number, status: v.status })),
        },
      };
    }

    case 'note': {
      const note = mockNotes.find((n) => n.id === id || n.code.toLowerCase() === id.toLowerCase()) || mockNotes[0];
      if (!note) return null;
      return {
        id: note.id,
        type: 'note',
        code: note.code,
        title: note.title,
        subtitle: `Author: ${note.author} (${note.role}) • ${note.timestamp}`,
        description: note.text,
        status: 'Active',
        properties: {
          'Author': note.author,
          'Role': note.role,
          'Timestamp': note.timestamp,
          'Associated Show': note.project_code,
        },
        tags: ['Supervisor Directive', note.project_code],
        relations: {
          project: { id: 'proj-001', type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: note.project_code, status: 'In Progress' },
          assignee: { id: 'usr-001', type: 'person', title: note.author, subtitle: note.role },
        },
      };
    }

    case 'delivery': {
      const del = mockDeliveries.find((d) => d.id === id || d.code.toLowerCase() === id.toLowerCase()) || mockDeliveries[0];
      if (!del) return null;
      return {
        id: del.id,
        type: 'delivery',
        code: del.code,
        title: del.title,
        subtitle: `Target: ${del.target} • Due: ${del.due_date}`,
        description: `High-bandwidth client turnover package for show ${del.project_code}. Package volume: ${del.package_size}.`,
        status: del.status,
        properties: {
          'Delivery Package': del.code,
          'Target Pipeline / Server': del.target,
          'Payload Size': del.package_size,
          'Delivery Deadline': del.due_date,
          'Client Signoff Status': del.status,
        },
        tags: ['Delivery Package', del.status],
        relations: {
          project: { id: del.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: del.project_code, status: 'In Progress' },
          client: { id: 'cli-01', type: 'client', title: 'Warner Nexus Studios', code: 'WNEX' },
        },
      };
    }

    case 'schedule': {
      const sch = mockSchedules.find((s) => s.id === id || s.code.toLowerCase() === id.toLowerCase()) || mockSchedules[0];
      if (!sch) return null;
      return {
        id: sch.id,
        type: 'schedule',
        code: sch.code,
        title: sch.title,
        subtitle: `${sch.project_code} • ${sch.start_date} → ${sch.end_date}`,
        description: `Production milestone tracking with ${sch.progress}% milestone completion.`,
        status: sch.status,
        properties: {
          'Milestone Tag': sch.code,
          'Start Date': sch.start_date,
          'Target Delivery': sch.end_date,
          'Progress': `${sch.progress}%`,
        },
        tags: ['Milestone', sch.project_code],
        relations: {
          project: { id: sch.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: sch.project_code, status: 'In Progress' },
        },
      };
    }

    case 'resource': {
      const res = mockResources.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase()) || mockResources[0];
      if (!res) return null;
      return {
        id: res.id,
        type: 'resource',
        code: res.code,
        title: res.title,
        subtitle: `${res.type} • Utilization: ${res.utilization}`,
        description: `Hardware compute or NVMe storage resource allocated to: ${res.allocated_to}.`,
        status: res.status,
        properties: {
          'Resource Class': res.type,
          'Capacity Spec': res.capacity,
          'Current Farm Load': res.utilization,
          'Assigned Productions': res.allocated_to,
        },
        tags: [res.type, res.status],
        relations: {
          parent: { id: 'org-apex-01', type: 'organization', title: 'Apex Digital Studios', code: 'APEX' },
        },
      };
    }

    case 'publishing': {
      const pub = mockPublishRecords.find((p) => p.id === id || p.entity_code.toLowerCase() === id.toLowerCase()) || mockPublishRecords[0];
      if (!pub) return null;
      return {
        id: pub.id,
        type: 'publishing',
        code: `${pub.entity_code}_${pub.version_number}_PUB`,
        title: `${pub.entity_code} ${pub.version_number} OpenUSD Publish`,
        subtitle: `${pub.dcc_software} • Submitter: ${pub.publisher_name} (${pub.department})`,
        description: pub.comment || `Published USD layer for ${pub.entity_code}. Pyblish validator: ${pub.pyblish_status}.`,
        status: pub.pyblish_status === 'Passed' ? 'Approved' : 'Pending Review',
        thumbnail_url: pub.publisher_avatar,
        created_at: pub.published_at,
        properties: {
          'Target Entity': `${pub.entity_type} [${pub.entity_code}]`,
          'Version Tag': pub.version_number,
          'Authoring DCC': `${pub.dcc_software} ${pub.dcc_version}`,
          'USD Stage Path': pub.usd_stage_path,
          'USD Layer Ref': pub.usd_layer_identifier,
          'Pyblish Status': pub.pyblish_status,
          'Hero Layer Promoted': pub.is_hero_promoted ? 'Yes (Active Hero)' : 'No',
          'Payload Size': `${pub.file_size_mb} MB`,
        },
        tags: [pub.department, pub.dcc_software, pub.pyblish_status],
        relations: {
          project: { id: pub.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: pub.project_code, status: 'In Progress' },
          shot: pub.entity_type === 'Shot' ? { id: pub.entity_id, type: 'shot', title: pub.entity_code, code: pub.entity_code, status: 'In Progress' } : undefined,
          asset: pub.entity_type === 'Asset' ? { id: pub.entity_id, type: 'asset', title: pub.entity_code, code: pub.entity_code, status: 'In Progress' } : undefined,
          assignee: { id: pub.publisher_id, type: 'person', title: pub.publisher_name, subtitle: pub.department, thumbnail_url: pub.publisher_avatar },
        },
      };
    }

    case 'playlist': {
      const ply = mockPlaylists.find((p) => p.id === id || p.code.toLowerCase() === id.toLowerCase()) || mockPlaylists[0];
      if (!ply) return null;
      return {
        id: ply.id,
        type: 'playlist',
        code: ply.code,
        title: ply.name,
        subtitle: `${ply.type} • ${ply.items_count} Cuts (${ply.total_duration_timecode})`,
        description: ply.description,
        status: ply.status,
        thumbnail_url: ply.entries[0]?.thumbnail_url,
        created_at: ply.created_at,
        updated_at: ply.updated_at,
        properties: {
          'Playlist Type': ply.type,
          'Reel Cuts': `${ply.items_count} items`,
          'Total Frames': `${ply.total_duration_frames} frames (${ply.total_duration_timecode})`,
          'Reel Curator': ply.author_name,
          'Session Status': ply.status,
          'Lock State': ply.is_locked ? 'Locked' : 'Editable',
        },
        tags: [ply.type, ply.status],
        relations: {
          project: { id: ply.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: ply.project_code, status: 'In Progress' },
          assignee: { id: ply.author_id, type: 'person', title: ply.author_name, subtitle: 'Curator', thumbnail_url: ply.author_avatar },
          shots: ply.entries.filter((e) => e.entity_type === 'Shot').map((e) => ({ id: `shot-${e.item_order}`, type: 'shot', title: e.entity_code, code: e.entity_code, subtitle: e.version_number, thumbnail_url: e.thumbnail_url })),
        },
      };
    }

    case 'workflow': {
      const wf = mockWorkflows.find((w) => w.id === id || w.code.toLowerCase() === id.toLowerCase()) || mockWorkflows[0];
      if (!wf) return null;
      const stepsCount = wf.nodes?.length || wf.steps_count || 0;
      const autoCount = wf.automation_rules?.length || wf.automation_triggers_count || 0;
      return {
        id: wf.id,
        type: 'workflow',
        code: wf.code,
        title: wf.name,
        subtitle: `${wf.category} • v${wf.version} • ${stepsCount} Linear DAG Steps`,
        description: wf.description,
        status: wf.is_active ? 'Active' : 'Inactive',
        created_at: wf.created_at,
        updated_at: wf.updated_at,
        properties: {
          'Pipeline Category': wf.category,
          'Schema Version': wf.version,
          'DAG Steps': `${stepsCount} Departmental Steps`,
          'Active Automation Triggers': `${autoCount} Events`,
          'Last Executed': wf.last_executed_at ? new Date(wf.last_executed_at).toLocaleString() : 'Never',
        },
        tags: [wf.category, wf.code],
        relations: {
          project: { id: wf.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: wf.project_code, status: 'In Progress' },
        },
      };
    }

    case 'timelog': {
      const tlog = mockTimelogs.find((t) => t.id === id) || mockTimelogs[0];
      if (!tlog) return null;
      return {
        id: tlog.id,
        type: 'timelog',
        code: `TIME-${tlog.id.toUpperCase()}`,
        title: `${tlog.artist_name}: ${tlog.task_title} (${tlog.hours_logged} hrs)`,
        subtitle: `${tlog.department} • ${tlog.entity_code} • ${tlog.date_logged}`,
        description: tlog.description,
        status: tlog.approved_by_name ? 'Approved' : 'Pending',
        created_at: tlog.created_at,
        properties: {
          'Artist': tlog.artist_name,
          'Department': tlog.department,
          'Target Entity': tlog.entity_code,
          'Hours Logged': `${tlog.hours_logged} hrs`,
          'Date': tlog.date_logged,
          'Overtime': tlog.is_overtime ? 'Yes (1.5x OT)' : 'Standard Hours',
          'Activity Category': tlog.activity_category,
          'Billing Rate': `$${tlog.billing_rate_usd}/hr`,
          'Approved By': tlog.approved_by_name || 'Pending Review',
        },
        tags: [tlog.department, tlog.activity_category],
        relations: {
          project: { id: tlog.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: tlog.project_code, status: 'In Progress' },
          assignee: { id: tlog.artist_id, type: 'person', title: tlog.artist_name, subtitle: tlog.department, thumbnail_url: tlog.artist_avatar },
        },
      };
    }

    case 'calendar': {
      const cal = mockCalendarMilestones.find((c) => c.id === id) || mockCalendarMilestones[0];
      if (!cal) return null;
      return {
        id: cal.id,
        type: 'calendar',
        code: `CAL-${cal.id.toUpperCase()}`,
        title: cal.title,
        subtitle: `${cal.category} • ${cal.start_date} → ${cal.end_date}`,
        description: cal.deliverables_summary,
        status: cal.status,
        created_at: cal.created_at,
        properties: {
          'Milestone Category': cal.category,
          'Start Date': cal.start_date,
          'Target Delivery': cal.end_date,
          'Milestone Progress': `${cal.progress_pct}%`,
          'Milestone Lead': `${cal.owner_name} (${cal.department_lead})`,
          'Shots Affected': `${cal.shots_affected} cuts`,
          'Critical Path': cal.critical_path ? 'Yes (Hard Lock)' : 'No',
        },
        tags: [cal.category, cal.status],
        relations: {
          project: { id: cal.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: cal.project_code, status: 'In Progress' },
        },
      };
    }

    case 'media': {
      const med = mockMediaAssets.find((m) => m.id === id || m.code.toLowerCase() === id.toLowerCase()) || mockMediaAssets[0];
      if (!med) return null;
      return {
        id: med.id,
        type: 'media',
        code: med.code,
        title: med.title,
        subtitle: `${med.media_type} • ${med.file_format} • ${med.file_size_mb} MB`,
        description: med.description,
        status: 'Active',
        thumbnail_url: med.thumbnail_url,
        created_at: med.created_at,
        properties: {
          'Media Category': med.media_type,
          'File Name': med.file_name,
          'Format': med.file_format,
          'Resolution': med.resolution || 'N/A',
          'Framerate': med.fps ? `${med.fps} FPS` : 'N/A',
          'Color Space': med.color_space,
          'Storage Path': med.source_url,
          'Uploaded By': med.uploaded_by,
        },
        tags: [med.media_type, med.file_format],
        relations: {
          project: { id: med.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: med.project_code, status: 'In Progress' },
        },
      };
    }

    case 'attachment': {
      const att = mockProductionAttachments.find((a) => a.id === id || a.code.toLowerCase() === id.toLowerCase()) || mockProductionAttachments[0];
      if (!att) return null;
      return {
        id: att.id,
        type: 'attachment',
        code: att.code,
        title: att.file_name,
        subtitle: `${att.category} • ${att.file_type} (${(att.file_size_kb / 1024).toFixed(1)} MB)`,
        description: att.description,
        status: 'Active',
        created_at: att.created_at,
        properties: {
          'Document Category': att.category,
          'File Format': att.file_type,
          'File Size': `${(att.file_size_kb / 1024).toFixed(2)} MB`,
          'Document Version': att.version,
          'Security Classification': att.security_classification,
          'Uploaded By': att.uploaded_by,
        },
        tags: [att.category, att.security_classification],
        relations: {
          project: { id: att.project_id, type: 'project', title: 'Cyberpunk 2099: Neo-Kyoto', code: att.project_code, status: 'In Progress' },
        },
      };
    }

    default:
      return null;
  }
}

/**
 * Universal Global Search across all entity collections
 */
export function searchUniversalEntities(query: string, filterType?: UniversalEntityType): EntityReference[] {
  const q = query.trim().toLowerCase();
  const all: EntityReference[] = [];

  // Organizations
  if (!filterType || filterType === 'organization') {
    mockOrganizations.forEach((o) => {
      if (!q || o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)) {
        all.push({ id: o.id, type: 'organization', title: o.name, code: o.code, subtitle: o.headquarters, status: o.status, thumbnail_url: o.logo_url });
      }
    });
  }

  // Clients
  if (!filterType || filterType === 'client') {
    mockClients.forEach((c) => {
      if (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) {
        all.push({ id: c.id, type: 'client', title: c.name, code: c.code, subtitle: c.studio_type, status: c.status, thumbnail_url: c.logo_url });
      }
    });
  }

  // Vendors
  if (!filterType || filterType === 'vendor') {
    mockVendors.forEach((v) => {
      if (!q || v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q)) {
        all.push({ id: v.id, type: 'vendor', title: v.name, code: v.code, subtitle: v.specialization, status: v.status, thumbnail_url: v.logo_url });
      }
    });
  }

  // People
  if (!filterType || filterType === 'person') {
    mockPeople.forEach((p) => {
      if (!q || p.full_name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.department_name.toLowerCase().includes(q)) {
        all.push({ id: p.id, type: 'person', title: p.full_name, code: p.role, subtitle: `${p.role} (${p.department_name})`, status: p.availability_status, thumbnail_url: p.avatar_url });
      }
    });
  }

  // Projects
  if (!filterType || filterType === 'project') {
    getRealProjects().forEach((p) => {
      if (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) {
        all.push({ id: p.id, type: 'project', title: p.name, code: p.code, subtitle: p.type, status: p.status, thumbnail_url: p.thumbnail_url });
      }
    });
  }

  // Shots
  if (!filterType || filterType === 'shot') {
    mockShots.forEach((s) => {
      if (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.sequence_code.toLowerCase().includes(q)) {
        all.push({ id: s.id, type: 'shot', title: s.name, code: s.code, subtitle: `${s.project_code} • ${s.current_version}`, status: s.status, thumbnail_url: s.thumbnail_url });
      }
    });
  }

  // Assets
  if (!filterType || filterType === 'asset') {
    mockAssets.forEach((a) => {
      if (!q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)) {
        all.push({ id: a.id, type: 'asset', title: a.name, code: a.code, subtitle: `${a.category} • ${a.version}`, status: a.status, thumbnail_url: a.thumbnail_url });
      }
    });
  }

  // Tasks
  if (!filterType || filterType === 'task') {
    mockTasks.forEach((t) => {
      if (!q || t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.entity_code.toLowerCase().includes(q)) {
        all.push({ id: t.id, type: 'task', title: t.title, code: t.code, subtitle: `${t.department} • ${t.entity_code}`, status: t.status });
      }
    });
  }

  // Versions
  if (!filterType || filterType === 'version') {
    mockPublishedVersions.forEach((v) => {
      if (!q || v.entity_code.toLowerCase().includes(q) || v.version_number.toLowerCase().includes(q)) {
        all.push({ id: v.id, type: 'version', title: `${v.entity_code} ${v.version_number}`, code: v.version_number, subtitle: `${v.department} • ${v.project_code}`, status: v.status, thumbnail_url: v.thumbnail_url });
      }
    });
  }

  // Reviews
  if (!filterType || filterType === 'review') {
    mockReviews.forEach((r) => {
      if (!q || r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.entity_code.toLowerCase().includes(q)) {
        all.push({ id: r.id, type: 'review', title: r.title, code: r.code, subtitle: `${r.entity_code} ${r.version_number}`, status: r.status, thumbnail_url: r.thumbnail_url });
      }
    });
  }

  // Playlists
  if (!filterType || filterType === 'playlist') {
    mockPlaylists.forEach((pl) => {
      if (!q || pl.name.toLowerCase().includes(q) || pl.code.toLowerCase().includes(q)) {
        all.push({ id: pl.id, type: 'playlist', title: pl.name, code: pl.code, subtitle: `${pl.type} (${pl.items_count} cuts)`, status: pl.status, thumbnail_url: pl.entries[0]?.thumbnail_url });
      }
    });
  }

  // Media
  if (!filterType || filterType === 'media') {
    mockMediaAssets.forEach((m) => {
      if (!q || m.title.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || m.file_name.toLowerCase().includes(q)) {
        all.push({ id: m.id, type: 'media', title: m.title, code: m.code, subtitle: `${m.media_type} • ${m.file_format}`, status: 'Active', thumbnail_url: m.thumbnail_url });
      }
    });
  }

  // Attachments
  if (!filterType || filterType === 'attachment') {
    mockProductionAttachments.forEach((a) => {
      if (!q || a.file_name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)) {
        all.push({ id: a.id, type: 'attachment', title: a.file_name, code: a.code, subtitle: a.category, status: 'Active' });
      }
    });
  }

  // Departments
  if (!filterType || filterType === 'department') {
    mockDepartments.forEach((d) => {
      if (!q || d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)) {
        all.push({ id: d.id, type: 'department', title: d.name, code: d.code, subtitle: `Head: ${d.head_name}` });
      }
    });
  }

  // Teams
  if (!filterType || filterType === 'team') {
    mockTeams.forEach((t) => {
      if (!q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)) {
        all.push({ id: t.id, type: 'team', title: t.name, code: t.code, subtitle: `${t.department_name} • ${t.current_project_code}` });
      }
    });
  }

  // Offices
  if (!filterType || filterType === 'office') {
    mockOffices.forEach((o) => {
      if (!q || o.name.toLowerCase().includes(q) || o.city.toLowerCase().includes(q)) {
        all.push({ id: o.id, type: 'office', title: o.name, code: o.code, subtitle: `${o.city}, ${o.country}` });
      }
    });
  }

  return all;
}

/**
 * Format entity type into human label
 */
export function formatEntityType(type: UniversalEntityType): string {
  const map: Record<UniversalEntityType, string> = {
    organization: 'Organization',
    client: 'Client Studio',
    vendor: 'Vendor Partner',
    person: 'Crew Member',
    department: 'Department',
    team: 'Squad / Team',
    office: 'Office Facility',
    project: 'Project Show',
    sequence: 'Sequence',
    shot: 'Shot Cut',
    asset: 'Asset Element',
    task: 'Task Item',
    version: 'Published Version',
    review: 'Review Session',
    note: 'Supervisor Directive',
    delivery: 'Client Delivery',
    schedule: 'Schedule Milestone',
    resource: 'Compute / SAN Resource',
    publishing: 'USD Publish Record',
    playlist: 'Review Playlist / Reel',
    workflow: 'Pipeline Workflow DAG',
    timelog: 'Artist Timelog',
    calendar: 'Production Calendar',
    media: 'Source Media / Plate',
    attachment: 'Production Attachment',
  };
  return map[type] || type;
}
