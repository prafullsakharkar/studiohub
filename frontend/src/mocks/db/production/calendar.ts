import { BaseEntity } from '@/types/common';

export interface CalendarMilestone extends BaseEntity {
  id: string;
  project_id: string;
  project_code: string;
  title: string;
  category: 'Client Turnover' | 'Internal Milestone' | 'Vendor Turnover' | 'Final Delivery' | 'Dailies Screening' | 'Editorial Lock';
  start_date: string;
  end_date: string;
  status: 'Completed' | 'In Progress' | 'Upcoming' | 'At Risk';
  progress_pct: number;
  owner_name: string;
  department_lead: string;
  deliverables_summary: string;
  shots_affected: number;
  critical_path: boolean;
}

export const mockCalendarMilestones: CalendarMilestone[] = [
  {
    id: 'cal-001',
    project_id: 'proj-001',
    project_code: 'NK99',
    title: 'Trailer 02 Final VFX Lockdown & QC',
    category: 'Final Delivery',
    start_date: '2026-08-25',
    end_date: '2026-08-28',
    status: 'In Progress',
    progress_pct: 78,
    owner_name: 'Alex Chen',
    department_lead: 'Elena Rostova',
    deliverables_summary: '24 Hero DCI 4K EXR shot composites + 5.1 Dolby Atmos sync master.',
    shots_affected: 24,
    critical_path: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
  },
  {
    id: 'cal-002',
    project_id: 'proj-001',
    project_code: 'NK99',
    title: 'Sequence 020 Underground Slums Matchmove Turnover',
    category: 'Internal Milestone',
    start_date: '2026-08-15',
    end_date: '2026-08-22',
    status: 'In Progress',
    progress_pct: 90,
    owner_name: 'Kenji Takahashi',
    department_lead: 'Kenji Takahashi',
    deliverables_summary: '18 camera solve USD caches and lidar point cloud alignments.',
    shots_affected: 18,
    critical_path: false,
    created_at: '2026-07-10T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
  },
  {
    id: 'cal-003',
    project_id: 'proj-001',
    project_code: 'NK99',
    title: 'Hero Spinner Vehicle LookDev & Rig Lock',
    category: 'Internal Milestone',
    start_date: '2026-08-01',
    end_date: '2026-08-18',
    status: 'Completed',
    progress_pct: 100,
    owner_name: 'Sarah Jenkins',
    department_lead: 'Sarah Jenkins',
    deliverables_summary: 'Master OpenUSD payload with 4 LOD levels and rain shaders approved.',
    shots_affected: 42,
    critical_path: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-08-18T00:00:00Z',
  },
  {
    id: 'cal-004',
    project_id: 'proj-001',
    project_code: 'NK99',
    title: 'Warner Nexus Execs Bi-Weekly Milestone Screening',
    category: 'Dailies Screening',
    start_date: '2026-08-22',
    end_date: '2026-08-22',
    status: 'Upcoming',
    progress_pct: 40,
    owner_name: 'Marcus Vance',
    department_lead: 'Alex Chen',
    deliverables_summary: 'Curated 14-shot review reel in Dolby Vision D65.',
    shots_affected: 14,
    critical_path: false,
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
  },
];
