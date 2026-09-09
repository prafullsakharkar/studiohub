import { BaseEntity } from '@/types/common';

export interface TimelogEntry extends BaseEntity {
  id: string;
  project_id: string;
  project_code: string;
  artist_id: string;
  artist_name: string;
  artist_avatar?: string;
  department: string;
  entity_type: 'Shot' | 'Asset' | 'General Production';
  entity_code: string;
  task_title: string;
  hours_logged: number;
  date_logged: string;
  is_overtime: boolean;
  activity_category: 'Direct Work' | 'Revisions' | 'Dailies / Meetings' | 'Pipeline Debug' | 'Rendering Wait';
  description: string;
  billing_rate_usd: number;
  approved_by_name?: string;
}

export const mockTimelogs: TimelogEntry[] = [
  {
    id: 'time-001',
    project_id: 'proj-001',
    project_code: 'NK99',
    artist_id: 'usr-003',
    artist_name: 'Elena Rostova',
    artist_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    department: 'Compositing',
    entity_type: 'Shot',
    entity_code: 'NK_010_0010',
    task_title: 'Hero Comp & Hologram Integration',
    hours_logged: 7.5,
    date_logged: '2026-08-20',
    is_overtime: false,
    activity_category: 'Direct Work',
    description: 'Rotoscoping vehicle reflections and matching bokeh optical blur against 35mm anamorphic reference plate.',
    billing_rate_usd: 95,
    approved_by_name: 'Alex Chen',
    created_at: '2026-08-20T18:00:00Z',
    updated_at: '2026-08-20T18:00:00Z',
  },
  {
    id: 'time-002',
    project_id: 'proj-001',
    project_code: 'NK99',
    artist_id: 'usr-004',
    artist_name: 'Sarah Jenkins',
    artist_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    department: 'Texturing & LookDev',
    entity_type: 'Asset',
    entity_code: 'SPINNER_HERO',
    task_title: 'Wet Surface LookDev & Rain Shaders',
    hours_logged: 8.0,
    date_logged: '2026-08-20',
    is_overtime: false,
    activity_category: 'Direct Work',
    description: 'Tuning anisotropic highlights and carbon-fiber clear-coat scattering parameters in Solaris.',
    billing_rate_usd: 110,
    approved_by_name: 'Alex Chen',
    created_at: '2026-08-20T18:30:00Z',
    updated_at: '2026-08-20T18:30:00Z',
  },
  {
    id: 'time-003',
    project_id: 'proj-001',
    project_code: 'NK99',
    artist_id: 'usr-005',
    artist_name: 'Dmitri Volkov',
    artist_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    department: 'FX & Simulation',
    entity_type: 'Shot',
    entity_code: 'NK_010_0020',
    task_title: 'Missile Trail Pyroclastic Sim',
    hours_logged: 9.5,
    date_logged: '2026-08-19',
    is_overtime: true,
    activity_category: 'Direct Work',
    description: 'High-res grid up-res simulation cache with micro-turbulence dissipation.',
    billing_rate_usd: 105,
    approved_by_name: 'Alex Chen',
    created_at: '2026-08-19T21:00:00Z',
    updated_at: '2026-08-19T21:00:00Z',
  },
  {
    id: 'time-004',
    project_id: 'proj-001',
    project_code: 'NK99',
    artist_id: 'usr-001',
    artist_name: 'Alex Chen',
    artist_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    department: 'Supervision',
    entity_type: 'General Production',
    entity_code: 'NK99-ALL',
    task_title: 'Morning Dailies & Client Feedback Review',
    hours_logged: 4.0,
    date_logged: '2026-08-20',
    is_overtime: false,
    activity_category: 'Dailies / Meetings',
    description: 'Conducted Sequence 010 dailies session with 18 artists, delivered frame-by-frame annotations.',
    billing_rate_usd: 150,
    approved_by_name: 'Marcus Vance',
    created_at: '2026-08-20T12:00:00Z',
    updated_at: '2026-08-20T12:00:00Z',
  },
];
