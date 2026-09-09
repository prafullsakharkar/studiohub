import {
  SearchResultItem,
  SearchableEntityType,
  SavedSearch,
  RecentSearch,
  SearchFilters,
  SearchFacets,
} from '@/types/intelligence';

// Import domain datasets to index
import { mockProjects } from '@/mocks/db/production/projects';
import { mockShots } from '@/mocks/db/production/shots';
import { mockTasks } from '@/mocks/db/tasks/tasks';
import { mockAssets } from '@/mocks/db/assets/assets';
import { mockReviews } from '@/mocks/db/reviews/reviews';
import {
  mockClients,
  mockVendors,
  mockPeople,
  mockDepartments,
  mockTeams,
  mockOffices,
  mockOrganizations,
  mockPublishedVersions,
} from '@/mocks/db/organization/organization';
import { mockKnowledgeDocuments } from './knowledge';

export const mockSavedSearches: SavedSearch[] = [
  {
    id: 'save-001',
    name: 'Blocked & High-Priority Comp Tasks (NK99)',
    description: 'Active compositing tasks with blocking dependencies in Nebula Knights',
    filters: {
      query: 'comp',
      entity_types: ['task'],
      project_codes: ['NK99'],
      organization_ids: [],
      departments: ['Compositing'],
      statuses: ['in_progress', 'blocked'],
      tags: [],
      sort_by: 'relevance',
    },
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-20T14:30:00Z',
    is_favorite: true,
    user_id: 'usr-001',
  },
  {
    id: 'save-002',
    name: 'Pending Supervisor Dailies & Reviews',
    description: 'Shots currently awaiting director or supervisor screening review',
    filters: {
      query: '',
      entity_types: ['review', 'version'],
      project_codes: [],
      organization_ids: [],
      departments: [],
      statuses: ['pending_review'],
      tags: [],
      sort_by: 'date_desc',
    },
    created_at: '2026-08-10T12:00:00Z',
    updated_at: '2026-08-24T18:00:00Z',
    is_favorite: true,
    user_id: 'usr-001',
  },
  {
    id: 'save-003',
    name: 'USD & ACES Pipeline SOPs',
    description: 'Core pipeline standards for OpenUSD composition and ACEScg color workflows',
    filters: {
      query: 'USD ACES',
      entity_types: ['knowledge'],
      project_codes: [],
      organization_ids: [],
      departments: ['Pipeline & Tooling'],
      statuses: [],
      tags: ['USD', 'Pipeline'],
      sort_by: 'relevance',
    },
    created_at: '2026-08-15T09:15:00Z',
    updated_at: '2026-08-15T09:15:00Z',
    is_favorite: false,
    user_id: 'usr-001',
  },
  {
    id: 'save-004',
    name: 'External Aspera Packages & Client Deliveries',
    description: 'Active client turnover dispatches to Paramount and Warner Bros',
    filters: {
      query: 'delivery turnover',
      entity_types: ['delivery'],
      project_codes: ['NK99', 'DUNE'],
      organization_ids: [],
      departments: [],
      statuses: [],
      tags: [],
      sort_by: 'date_desc',
    },
    created_at: '2026-08-18T16:00:00Z',
    updated_at: '2026-08-25T11:00:00Z',
    is_favorite: false,
    user_id: 'usr-001',
  },
];

export const mockRecentSearches: RecentSearch[] = [
  {
    id: 'rec-001',
    query: 'Titan Alpha USD payloads',
    timestamp: '2026-08-26T00:20:00Z',
  },
  {
    id: 'rec-002',
    query: 'NK99-010-010 comp',
    timestamp: '2026-08-25T22:15:00Z',
  },
  {
    id: 'rec-003',
    query: 'Paramount delivery checklist',
    timestamp: '2026-08-25T18:40:00Z',
  },
  {
    id: 'rec-004',
    query: 'Houdini pyro simulation SOP',
    timestamp: '2026-08-25T14:10:00Z',
  },
];

// Build unified cross-entity index
export function buildGlobalSearchIndex(): SearchResultItem[] {
  const index: SearchResultItem[] = [];

  // 1. Projects
  mockProjects.forEach((p: any) => {
    index.push({
      id: `sr-proj-${p.id}`,
      entity_type: 'project',
      entity_id: p.id,
      title: p.name,
      subtitle: `Code: [${p.code}] • Client: ${p.client_name || 'Studio Production'}`,
      description: p.description || 'Feature visual effects project',
      project_code: p.code,
      organization_name: 'Industrial Pixel Magic',
      status: p.status,
      tags: ['VFX', p.code, p.status],
      url: `/projects/${p.id}`,
      updated_at: p.updated_at || '2026-08-20T00:00:00Z',
      score: 1.0,
      metadata: { code: p.code, status: p.status, shot_count: p.shot_count || 120 },
    });
  });

  // 2. Shots
  mockShots.forEach((s: any) => {
    index.push({
      id: `sr-shot-${s.id}`,
      entity_type: 'shot',
      entity_id: s.id,
      title: `${s.code}: ${s.name || s.description || 'Sequence Shot'}`,
      subtitle: `Project: ${s.project_code || 'NK99'} • Sequence: ${s.sequence_code || 'SEQ_010'}`,
      description: s.description || `Frame Range: ${s.frame_in}-${s.frame_out} (${s.frame_count || 120} frames)`,
      project_code: s.project_code || 'NK99',
      organization_name: 'Industrial Pixel Magic',
      status: s.status,
      tags: ['Shot', s.sequence_code || 'SEQ_010', s.status],
      thumbnail_url: s.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      url: `/shots/${s.id}`,
      updated_at: s.updated_at || '2026-08-24T00:00:00Z',
      score: 1.0,
      metadata: { frame_count: s.frame_count, supervisor: s.supervisor_name },
    });
  });

  // 3. Assets
  mockAssets.forEach((a: any) => {
    index.push({
      id: `sr-ast-${a.id}`,
      entity_type: 'asset',
      entity_id: a.id,
      title: `${a.name} (${a.code || 'AST'})`,
      subtitle: `Type: ${a.type || a.category || 'Prop'} • Project: ${a.project_code || 'NK99'}`,
      description: a.description || '3D Asset library component with USD payload bindings',
      project_code: a.project_code || 'NK99',
      organization_name: 'Industrial Pixel Magic',
      status: a.status,
      tags: ['Asset', a.type || a.category || 'Model', a.status],
      thumbnail_url: a.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
      url: `/assets/${a.id}`,
      updated_at: a.updated_at || '2026-08-22T00:00:00Z',
      score: 1.0,
      metadata: { asset_type: a.type || a.category },
    });
  });

  // 4. Tasks
  mockTasks.forEach((t: any) => {
    index.push({
      id: `sr-task-${t.id}`,
      entity_type: 'task',
      entity_id: t.id,
      title: `${t.title || t.name}`,
      subtitle: `Dept: ${t.department_name || t.department || 'Compositing'} • Assignee: ${t.assignee_name || 'Unassigned'}`,
      description: t.description || `Pipeline task status: ${t.status}. Due: ${t.due_date || 'Upcoming'}`,
      project_code: t.project_code || 'NK99',
      organization_name: 'Industrial Pixel Magic',
      status: t.status,
      tags: ['Task', t.department_name || t.department || 'Compositing', t.status],
      url: `/tasks/${t.id}`,
      updated_at: t.updated_at || '2026-08-25T00:00:00Z',
      score: 1.0,
      metadata: { department: t.department_name || t.department, priority: t.priority },
    });
  });

  // 5. Versions
  mockPublishedVersions.forEach((v: any) => {
    index.push({
      id: `sr-ver-${v.id}`,
      entity_type: 'version',
      entity_id: v.id,
      title: `${v.code || v.name || v.version_code} (${v.task_name || 'Render Output'})`,
      subtitle: `Version: ${v.version_number} • Artist: ${v.artist_name || 'Production Artist'}`,
      description: v.notes || `Published ACEScg render sequence. Frame count: ${v.frame_count || 120}`,
      project_code: v.project_code || 'NK99',
      organization_name: 'Industrial Pixel Magic',
      status: v.status,
      tags: ['Version', v.status, v.code || 'v01'],
      thumbnail_url: v.thumbnail_url,
      url: `/versions/${v.id}`,
      updated_at: v.created_at || '2026-08-25T12:00:00Z',
      score: 1.0,
      metadata: { version_number: v.version_number, frame_range: v.frame_range },
    });
  });

  // 6. Reviews
  mockReviews.forEach((r: any) => {
    index.push({
      id: `sr-rev-${r.id}`,
      entity_type: 'review',
      entity_id: r.id,
      title: r.title,
      subtitle: `Room: ${r.room_name || 'Screening Theater A'} • Project: ${r.project_code || 'NK99'}`,
      description: r.description || `Daily review session with ${r.item_count || 8} queued shots for supervisor sign-off`,
      project_code: r.project_code || 'NK99',
      organization_name: 'Industrial Pixel Magic',
      status: r.status,
      tags: ['Review', 'Dailies', r.status],
      url: `/reviews/${r.id}`,
      updated_at: r.scheduled_at || r.updated_at || '2026-08-25T17:00:00Z',
      score: 1.0,
      metadata: { scheduled_at: r.scheduled_at, supervisor: r.supervisor_name || r.supervisor_notes },
    });
  });

  // 7. Deliveries
  index.push(
    {
      id: 'sr-del-001',
      entity_type: 'delivery',
      entity_id: 'del-001',
      title: 'NK99 Act 1 Final EXR Turnover (Paramount)',
      subtitle: 'Target: Paramount Global • 38 Approved Shots',
      description: 'Aspera secure package containing 32-bit ACEScg EXRs with DPX color metadata manifests',
      project_code: 'NK99',
      organization_name: 'Industrial Pixel Magic',
      status: 'dispatched',
      tags: ['Delivery', 'Aspera', 'Paramount', 'Turnover'],
      url: '/deliveries/del-001',
      updated_at: '2026-08-25T17:30:00Z',
      score: 1.0,
      metadata: { client: 'Paramount Pictures', size_gb: 480 },
    },
    {
      id: 'sr-del-002',
      entity_type: 'delivery',
      entity_id: 'del-002',
      title: 'DUNE Sisterhood Teaser Trailer Stems',
      subtitle: 'Target: Warner Bros • 14 Locked Shots',
      description: 'Stereo EXR matte passes and final composite stems for theatrical teaser turnover',
      project_code: 'DUNE',
      organization_name: 'Industrial Pixel Magic',
      status: 'pending_qa',
      tags: ['Delivery', 'WarnerBros', 'Trailer'],
      url: '/deliveries/del-002',
      updated_at: '2026-08-24T11:00:00Z',
      score: 1.0,
      metadata: { client: 'Warner Bros', size_gb: 290 },
    }
  );

  // 8. Organizations
  mockOrganizations.forEach((org: any) => {
    index.push({
      id: `sr-org-${org.id}`,
      entity_type: 'organization',
      entity_id: org.id,
      title: org.name,
      subtitle: `Studio Tier: ${org.tier || 'Enterprise'} • HQ: ${org.headquarters || 'Los Angeles'}`,
      description: `Primary VFX studio tenant managing multi-site creative production pipelines.`,
      organization_name: org.name,
      status: 'active',
      tags: ['Organization', 'Tenant', org.tier || 'Enterprise'],
      url: `/organization`,
      updated_at: '2026-08-01T00:00:00Z',
      score: 1.0,
      metadata: { active_projects: 4, crew_count: 142 },
    });
  });

  // 9. Clients
  mockClients.forEach((cli: any) => {
    index.push({
      id: `sr-cli-${cli.id}`,
      entity_type: 'client',
      entity_id: cli.id,
      title: cli.name,
      subtitle: `Contact: ${cli.primary_contact || 'Production Executive'} • Tier: ${cli.tier || 'Studio Major'}`,
      description: `Studio client partner for feature film and high-end episodic productions.`,
      organization_name: 'Industrial Pixel Magic',
      status: 'active',
      tags: ['Client', cli.name],
      url: `/clients`,
      updated_at: '2026-08-15T00:00:00Z',
      score: 1.0,
      metadata: { contact: cli.primary_contact },
    });
  });

  // 10. Vendors
  mockVendors.forEach((ven: any) => {
    index.push({
      id: `sr-ven-${ven.id}`,
      entity_type: 'vendor',
      entity_id: ven.id,
      title: ven.name,
      subtitle: `Specialty: ${ven.specialty || 'Stereo Conversion & Roto'} • Capacity: ${ven.active_capacity || 'High'}`,
      description: `External VFX partner handling roto, paint, and outsourced asset builds.`,
      organization_name: 'Industrial Pixel Magic',
      status: 'active',
      tags: ['Vendor', ven.specialty || 'Roto'],
      url: `/vendors`,
      updated_at: '2026-08-18T00:00:00Z',
      score: 1.0,
      metadata: { specialty: ven.specialty },
    });
  });

  // 11. People
  mockPeople.forEach((peep: any) => {
    index.push({
      id: `sr-peep-${peep.id}`,
      entity_type: 'person',
      entity_id: peep.id,
      title: peep.name || `${peep.first_name || ''} ${peep.last_name || ''}`.trim() || 'Crew Member',
      subtitle: `${peep.role || 'Artist'} • ${peep.department_name || 'Compositing'} (${peep.office_name || 'London'})`,
      description: `Production crew member. Email: ${peep.email || 'crew@studiohub.io'}`,
      organization_name: 'Industrial Pixel Magic',
      status: 'active',
      tags: ['Person', 'Crew', peep.department_name || 'VFX', peep.office_name || 'HQ'],
      thumbnail_url: peep.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      url: `/people`,
      updated_at: '2026-08-20T00:00:00Z',
      score: 1.0,
      metadata: { email: peep.email, role: peep.role, department: peep.department_name },
    });
  });

  // 12. Departments
  mockDepartments.forEach((dept) => {
    index.push({
      id: `sr-dept-${dept.id}`,
      entity_type: 'department',
      entity_id: dept.id,
      title: dept.name,
      subtitle: `Head: ${dept.head_name || 'Department Lead'} • ${dept.member_count || 18} Artists`,
      description: `Core VFX discipline handling shot pipeline deliverables.`,
      organization_name: 'Industrial Pixel Magic',
      status: 'active',
      tags: ['Department', dept.name],
      url: `/departments`,
      updated_at: '2026-08-01T00:00:00Z',
      score: 1.0,
      metadata: { member_count: dept.member_count },
    });
  });

  // 13. Teams
  mockTeams.forEach((team) => {
    index.push({
      id: `sr-team-${team.id}`,
      entity_type: 'team',
      entity_id: team.id,
      title: team.name,
      subtitle: `Dept: ${team.department_name || 'Compositing'} • Lead: ${team.lead_name || 'Lead Artist'}`,
      description: `Dedicated squad assigned to high-complexity sequence milestones.`,
      organization_name: 'Industrial Pixel Magic',
      status: 'active',
      tags: ['Team', team.name],
      url: `/teams`,
      updated_at: '2026-08-01T00:00:00Z',
      score: 1.0,
      metadata: { lead: team.lead_name },
    });
  });

  // 14. Offices
  mockOffices.forEach((off) => {
    index.push({
      id: `sr-off-${off.id}`,
      entity_type: 'office',
      entity_id: off.id,
      title: off.name,
      subtitle: `Location: ${off.city || 'Los Angeles'}, ${off.country || 'USA'} • Timezone: ${off.timezone || 'UTC-8'}`,
      description: `Studio facility and high-speed data hub.`,
      organization_name: 'Industrial Pixel Magic',
      status: 'active',
      tags: ['Office', off.city || 'Studio'],
      url: `/offices`,
      updated_at: '2026-08-01T00:00:00Z',
      score: 1.0,
      metadata: { timezone: off.timezone },
    });
  });

  // 15. Media
  index.push(
    {
      id: 'sr-med-001',
      entity_type: 'media',
      entity_id: 'med-001',
      title: 'NK99_010_010_ACEScg_Master_Plate.mov',
      subtitle: 'ProRes 4444 XQ • 4096x2160 DCI • 24.00fps',
      description: 'Camera Raw Arri Alexa 35 background live-action plate clip linearized for compositing',
      project_code: 'NK99',
      organization_name: 'Industrial Pixel Magic',
      status: 'verified',
      tags: ['Media', 'Plate', 'ProRes', 'ACEScg'],
      thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
      url: '/media',
      updated_at: '2026-08-24T09:00:00Z',
      score: 1.0,
      metadata: { codec: 'ProRes 4444 XQ', size_mb: 2400 },
    },
    {
      id: 'sr-med-002',
      entity_type: 'media',
      entity_id: 'med-002',
      title: 'Titan_Alpha_Turntable_4K.mp4',
      subtitle: 'H.264 LookDev Turntable with 360 HDRI Lighting Rig',
      description: 'Supervisor approval turntable demonstrating high-specular metal shaders in MaterialX',
      project_code: 'NK99',
      organization_name: 'Industrial Pixel Magic',
      status: 'approved',
      tags: ['Media', 'Turntable', 'LookDev'],
      thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
      url: '/media',
      updated_at: '2026-08-25T14:20:00Z',
      score: 1.0,
      metadata: { codec: 'H.264', size_mb: 180 },
    }
  );

  // 16. Knowledge Hub Documents
  mockKnowledgeDocuments.forEach((doc) => {
    index.push({
      id: `sr-kdoc-${doc.id}`,
      entity_type: 'knowledge',
      entity_id: doc.id,
      title: doc.title,
      subtitle: `Category: ${doc.category.toUpperCase()} • Author: ${doc.author_name} (${doc.version})`,
      description: doc.summary,
      project_code: doc.project_code || 'ALL',
      organization_name: 'Industrial Pixel Magic',
      status: 'published',
      tags: ['Knowledge', doc.category, ...doc.tags],
      url: `/knowledge/${doc.id}`,
      updated_at: doc.updated_at,
      score: 1.2, // Boost knowledge docs
      metadata: {
        category: doc.category,
        views: doc.views_count,
        likes: doc.likes_count,
        linked_count: doc.linked_entities.length,
      },
    });
  });

  return index;
}
